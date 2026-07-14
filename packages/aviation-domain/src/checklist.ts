import { z } from 'zod';

export const checklistCategorySchema = z.enum(['normal', 'abnormal', 'emergency']);
export type ChecklistCategory = z.infer<typeof checklistCategorySchema>;

const checklistItemSchema = z
  .object({
    challenge: z.string().trim().min(1).max(240),
    isCritical: z.boolean(),
    response: z.string().trim().min(1).max(240),
    sequence: z.number().int().min(0).max(99),
  })
  .strict();

export const checklistTemplateSchema = z
  .object({
    aircraftId: z.uuid().nullable(),
    aircraftLabel: z.string().trim().min(1).max(80),
    category: checklistCategorySchema,
    createdAt: z.iso.datetime(),
    id: z.uuid(),
    items: z.array(checklistItemSchema).min(1).max(100),
    revision: z.number().int().min(1),
    source: z.enum(['user-authored', 'generic-demonstration']),
    title: z.string().trim().min(1).max(120),
    updatedAt: z.iso.datetime(),
    verificationStatus: z.literal('unverified'),
  })
  .strict()
  .superRefine((template, context) => {
    template.items.forEach((item, index) => {
      if (item.sequence !== index) {
        context.addIssue({
          code: 'custom',
          message: 'Checklist item sequences must be contiguous from zero',
          path: ['items', index, 'sequence'],
        });
      }
    });
    if (Date.parse(template.updatedAt) < Date.parse(template.createdAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Updated time cannot precede created time',
        path: ['updatedAt'],
      });
    }
  });

export type ChecklistTemplate = z.infer<typeof checklistTemplateSchema>;

export const checklistRunSchema = z
  .object({
    abandonedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    completedSequences: z.array(z.number().int().min(0).max(99)).max(100),
    id: z.uuid(),
    itemCount: z.number().int().min(1).max(100),
    stateRevision: z.number().int().min(1),
    startedAt: z.iso.datetime(),
    templateId: z.uuid(),
    templateRevision: z.number().int().min(1),
    templateSnapshot: checklistTemplateSchema,
  })
  .strict()
  .superRefine((run, context) => {
    if (
      run.templateSnapshot.id !== run.templateId ||
      run.templateSnapshot.revision !== run.templateRevision ||
      run.templateSnapshot.items.length !== run.itemCount
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Checklist run metadata must match its immutable template snapshot',
        path: ['templateSnapshot'],
      });
    }
    if (
      new Set(run.completedSequences).size !== run.completedSequences.length ||
      run.completedSequences.some((sequence) => sequence >= run.itemCount)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Completed checklist sequences must be unique and in range',
        path: ['completedSequences'],
      });
    }
    const isComplete = run.completedSequences.length === run.itemCount;
    if (isComplete !== (run.completedAt !== null) || (run.abandonedAt !== null && isComplete)) {
      context.addIssue({
        code: 'custom',
        message: 'Checklist terminal state must match completion state',
        path: ['completedAt'],
      });
    }
    if (run.completedAt !== null && run.abandonedAt !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Checklist run cannot be both completed and abandoned',
        path: ['abandonedAt'],
      });
    }
    if (run.completedAt !== null && Date.parse(run.completedAt) < Date.parse(run.startedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Checklist completion cannot precede its start',
        path: ['completedAt'],
      });
    }
    if (run.abandonedAt !== null && Date.parse(run.abandonedAt) < Date.parse(run.startedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Checklist abandonment cannot precede its start',
        path: ['abandonedAt'],
      });
    }
  });

export type ChecklistRun = z.infer<typeof checklistRunSchema>;

export const startChecklistRun = (
  templateSource: ChecklistTemplate,
  id: string,
  startedAt: string,
): ChecklistRun => {
  const template = checklistTemplateSchema.parse(templateSource);
  return checklistRunSchema.parse({
    abandonedAt: null,
    completedAt: null,
    completedSequences: [],
    id,
    itemCount: template.items.length,
    stateRevision: 1,
    startedAt,
    templateId: template.id,
    templateRevision: template.revision,
    templateSnapshot: template,
  });
};

export const setChecklistItemCompleted = (
  source: ChecklistRun,
  sequence: number,
  completed: boolean,
  changedAt: string,
): ChecklistRun => {
  const run = checklistRunSchema.parse(source);
  if (!Number.isInteger(sequence) || sequence < 0 || sequence >= run.itemCount) {
    throw new RangeError('Checklist sequence is out of range');
  }
  if (
    !Number.isFinite(Date.parse(changedAt)) ||
    Date.parse(changedAt) < Date.parse(run.startedAt)
  ) {
    throw new Error('Checklist change time is invalid');
  }
  if (run.completedAt !== null || run.abandonedAt !== null) {
    throw new Error('A terminal checklist run is immutable');
  }
  const sequences = new Set(run.completedSequences);
  if (completed) sequences.add(sequence);
  else sequences.delete(sequence);
  const completedSequences = [...sequences].sort((left, right) => left - right);
  return checklistRunSchema.parse({
    ...run,
    completedAt: completedSequences.length === run.itemCount ? changedAt : null,
    completedSequences,
    stateRevision: run.stateRevision + 1,
  });
};

export const abandonChecklistRun = (
  source: ChecklistRun,
  abandonedAt: string,
): ChecklistRun => {
  const run = checklistRunSchema.parse(source);
  if (run.completedAt !== null || run.abandonedAt !== null) {
    throw new Error('A terminal checklist run is immutable');
  }
  if (
    !Number.isFinite(Date.parse(abandonedAt)) ||
    Date.parse(abandonedAt) < Date.parse(run.startedAt)
  ) {
    throw new Error('Checklist abandonment time is invalid');
  }
  return checklistRunSchema.parse({
    ...run,
    abandonedAt,
    stateRevision: run.stateRevision + 1,
  });
};
