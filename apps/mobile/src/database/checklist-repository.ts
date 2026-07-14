import {
  checklistRunSchema,
  checklistTemplateSchema,
  startChecklistRun,
  type ChecklistRun,
  type ChecklistTemplate,
} from '@driftline/aviation-domain';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface ChecklistTemplateRow {
  readonly aircraft_id: string | null;
  readonly aircraft_label: string;
  readonly category: ChecklistTemplate['category'];
  readonly created_at: string;
  readonly id: string;
  readonly revision: number;
  readonly source: ChecklistTemplate['source'];
  readonly title: string;
  readonly updated_at: string;
  readonly verification_status: 'unverified';
}

export interface ChecklistItemRow {
  readonly challenge: string;
  readonly is_critical: number;
  readonly response: string;
  readonly sequence: number;
  readonly template_id: string;
}

interface ChecklistRunRow {
  readonly abandoned_at: string | null;
  readonly completed_at: string | null;
  readonly id: string;
  readonly item_count: number;
  readonly started_at: string;
  readonly state_revision: number;
  readonly template_id: string;
  readonly template_revision: number;
  readonly template_snapshot_json: string;
}

interface ChecklistCompletionRow {
  readonly item_sequence: number;
}

export interface ChecklistRunCompletionRow extends ChecklistCompletionRow {
  readonly run_id: string;
}

export const decodeChecklistRuns = (
  rows: readonly ChecklistRunRow[],
  completionRows: readonly ChecklistRunCompletionRow[],
): readonly ChecklistRun[] => {
  const runIds = new Set(rows.map(({ id }) => id));
  const completionsByRun = new Map<string, ChecklistCompletionRow[]>();
  for (const completion of completionRows) {
    if (!runIds.has(completion.run_id)) {
      throw new Error('Checklist completion references an unavailable run');
    }
    const current = completionsByRun.get(completion.run_id) ?? [];
    current.push(completion);
    completionsByRun.set(completion.run_id, current);
  }
  return rows.map((row) => decodeChecklistRun(row, completionsByRun.get(row.id) ?? []));
};

export const decodeChecklistTemplates = (
  rows: readonly ChecklistTemplateRow[],
  itemRows: readonly ChecklistItemRow[],
): readonly ChecklistTemplate[] => {
  const templateIds = new Set(rows.map(({ id }) => id));
  const itemsByTemplate = new Map<string, ChecklistItemRow[]>();
  for (const item of itemRows) {
    if (!templateIds.has(item.template_id)) {
      throw new Error('Checklist item references an unavailable template');
    }
    if (item.is_critical !== 0 && item.is_critical !== 1) {
      throw new Error('Checklist critical flag is invalid');
    }
    const current = itemsByTemplate.get(item.template_id) ?? [];
    current.push(item);
    itemsByTemplate.set(item.template_id, current);
  }
  return rows.map((row) =>
    checklistTemplateSchema.parse({
      aircraftId: row.aircraft_id,
      aircraftLabel: row.aircraft_label,
      category: row.category,
      createdAt: row.created_at,
      id: row.id,
      items: (itemsByTemplate.get(row.id) ?? [])
        .sort((left, right) => left.sequence - right.sequence)
        .map((item) => ({
          challenge: item.challenge,
          isCritical: item.is_critical === 1,
          response: item.response,
          sequence: item.sequence,
        })),
      revision: row.revision,
      source: row.source,
      title: row.title,
      updatedAt: row.updated_at,
      verificationStatus: row.verification_status,
    }),
  );
};

export const decodeChecklistRun = (
  row: ChecklistRunRow,
  completionRows: readonly ChecklistCompletionRow[],
): ChecklistRun => {
  let templateSnapshot: unknown;
  try {
    templateSnapshot = JSON.parse(row.template_snapshot_json);
  } catch {
    throw new Error('Stored checklist snapshot is not valid JSON');
  }
  return checklistRunSchema.parse({
    abandonedAt: row.abandoned_at,
    completedAt: row.completed_at,
    completedSequences: completionRows.map(({ item_sequence }) => item_sequence),
    id: row.id,
    itemCount: row.item_count,
    startedAt: row.started_at,
    stateRevision: row.state_revision,
    templateId: row.template_id,
    templateRevision: row.template_revision,
    templateSnapshot,
  });
};

export const listChecklistTemplates = async (
  database: SQLiteDatabase,
): Promise<readonly ChecklistTemplate[]> => {
  const templateLimit = 100;
  const itemLimit = templateLimit * 100;
  const [rows, items] = await Promise.all([
    database.getAllAsync<ChecklistTemplateRow>(
      `SELECT id, aircraft_id, aircraft_label, category, created_at, revision, source,
        title, updated_at, verification_status
       FROM checklist_templates
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT ${templateLimit + 1}`,
    ),
    database.getAllAsync<ChecklistItemRow>(
      `SELECT item.template_id, item.sequence, item.challenge, item.response, item.is_critical
       FROM checklist_items AS item
       JOIN checklist_templates AS template ON template.id = item.template_id
       WHERE template.deleted_at IS NULL
       ORDER BY item.template_id, item.sequence
       LIMIT ${itemLimit + 1}`,
    ),
  ]);
  if (rows.length > templateLimit || items.length > itemLimit) {
    throw new Error('Checklist template collection exceeds supported limits');
  }
  return decodeChecklistTemplates(rows, items);
};

const insertChecklistItems = async (
  database: SQLiteDatabase,
  template: ChecklistTemplate,
): Promise<void> => {
  for (const item of template.items) {
    await database.runAsync(
      `INSERT INTO checklist_items
        (template_id, sequence, challenge, response, is_critical)
       VALUES (?, ?, ?, ?, ?)`,
      template.id,
      item.sequence,
      item.challenge,
      item.response,
      item.isCritical ? 1 : 0,
    );
  }
};

export const insertChecklistTemplate = async (
  database: SQLiteDatabase,
  source: ChecklistTemplate,
): Promise<void> => {
  const template = checklistTemplateSchema.parse(source);
  if (template.revision !== 1) throw new Error('A new checklist must begin at revision one');
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO checklist_templates (
        id, aircraft_id, created_at, updated_at, title, phase, revision, category,
        source, verification_status, aircraft_label
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      template.id,
      template.aircraftId,
      template.createdAt,
      template.updatedAt,
      template.title,
      template.category,
      template.revision,
      template.category,
      template.source,
      template.verificationStatus,
      template.aircraftLabel,
    );
    await insertChecklistItems(transaction, template);
  });
};

export const replaceChecklistTemplate = async (
  database: SQLiteDatabase,
  expectedRevision: number,
  source: ChecklistTemplate,
): Promise<void> => {
  const template = checklistTemplateSchema.parse(source);
  if (!Number.isInteger(expectedRevision) || template.revision !== expectedRevision + 1) {
    throw new Error('Checklist revision transition is invalid');
  }
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE checklist_templates SET
        aircraft_id = ?, updated_at = ?, title = ?, phase = ?, revision = ?, category = ?,
        aircraft_label = ?
       WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
      template.aircraftId,
      template.updatedAt,
      template.title,
      template.category,
      template.revision,
      template.category,
      template.aircraftLabel,
      template.id,
      expectedRevision,
    );
    if (result.changes !== 1) throw new Error('Checklist template changed on another writer');
    await transaction.runAsync(
      `DELETE FROM checklist_items WHERE template_id = ?`,
      template.id,
    );
    await insertChecklistItems(transaction, template);
  });
};

export const createChecklistRun = async (
  database: SQLiteDatabase,
  template: ChecklistTemplate,
  id: string,
  startedAt: string,
): Promise<ChecklistRun> => {
  const run = startChecklistRun(template, id, startedAt);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<{ readonly id: string }>(
      `SELECT id FROM checklist_runs
       WHERE completed_at IS NULL AND abandoned_at IS NULL LIMIT 1`,
    );
    if (existing !== null)
      throw new Error('Complete or abandon the active checklist before starting another');
    await transaction.runAsync(
      `INSERT INTO checklist_runs (
        id, template_id, template_revision, started_at, completed_at, abandoned_at,
        item_count, template_snapshot_json, state_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      run.id,
      run.templateId,
      run.templateRevision,
      run.startedAt,
      run.completedAt,
      run.abandonedAt,
      run.itemCount,
      JSON.stringify(run.templateSnapshot),
      run.stateRevision,
    );
  });
  return run;
};

export const loadLatestOpenChecklistRun = async (
  database: SQLiteDatabase,
): Promise<ChecklistRun | null> => {
  const row = await database.getFirstAsync<ChecklistRunRow>(
    `SELECT id, template_id, template_revision, started_at, completed_at, abandoned_at,
      item_count, template_snapshot_json, state_revision
     FROM checklist_runs
     WHERE completed_at IS NULL AND abandoned_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
  );
  if (row === null) return null;
  const completions = await database.getAllAsync<ChecklistCompletionRow>(
    `SELECT item_sequence FROM checklist_completions
     WHERE run_id = ? ORDER BY item_sequence`,
    row.id,
  );
  return decodeChecklistRun(row, completions);
};

export const listRecentTerminalChecklistRuns = async (
  database: SQLiteDatabase,
  limit = 20,
): Promise<readonly ChecklistRun[]> => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RangeError('Checklist history limit must be between 1 and 50');
  }
  let decoded: readonly ChecklistRun[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const rows = await transaction.getAllAsync<ChecklistRunRow>(
      `SELECT id, template_id, template_revision, started_at, completed_at, abandoned_at,
        item_count, template_snapshot_json, state_revision
       FROM checklist_runs
       WHERE completed_at IS NOT NULL OR abandoned_at IS NOT NULL
       ORDER BY COALESCE(completed_at, abandoned_at) DESC, id DESC
       LIMIT ?`,
      limit,
    );
    if (rows.length === 0) {
      decoded = [];
      return;
    }
    const completions = await transaction.getAllAsync<ChecklistRunCompletionRow>(
      `SELECT run_id, item_sequence
       FROM checklist_completions
       WHERE run_id IN (
         SELECT id FROM checklist_runs
         WHERE completed_at IS NOT NULL OR abandoned_at IS NOT NULL
         ORDER BY COALESCE(completed_at, abandoned_at) DESC, id DESC
         LIMIT ?
       )
       ORDER BY run_id, item_sequence`,
      limit,
    );
    decoded = decodeChecklistRuns(rows, completions);
  });
  return decoded;
};

export const persistChecklistRunTransition = async (
  database: SQLiteDatabase,
  beforeSource: ChecklistRun,
  afterSource: ChecklistRun,
  changedAt: string,
): Promise<void> => {
  const before = checklistRunSchema.parse(beforeSource);
  const after = checklistRunSchema.parse(afterSource);
  if (
    before.id !== after.id ||
    before.templateId !== after.templateId ||
    before.templateRevision !== after.templateRevision ||
    before.itemCount !== after.itemCount ||
    before.startedAt !== after.startedAt ||
    JSON.stringify(before.templateSnapshot) !== JSON.stringify(after.templateSnapshot) ||
    after.stateRevision !== before.stateRevision + 1
  ) {
    throw new Error('Checklist transition does not follow the stored revision');
  }
  if (before.completedAt !== null || before.abandonedAt !== null) {
    throw new Error('A terminal checklist run is immutable');
  }
  const beforeSequences = new Set(before.completedSequences);
  const afterSequences = new Set(after.completedSequences);
  const changedSequences = new Set(
    [...beforeSequences, ...afterSequences].filter(
      (sequence) => beforeSequences.has(sequence) !== afterSequences.has(sequence),
    ),
  );
  const isAbandonment = after.abandonedAt !== null;
  if (
    (isAbandonment && changedSequences.size !== 0) ||
    (!isAbandonment && changedSequences.size !== 1) ||
    (after.completedAt !== null && after.completedAt !== changedAt) ||
    (after.abandonedAt !== null && after.abandonedAt !== changedAt)
  ) {
    throw new Error('Checklist transition changes an unsupported state');
  }
  if (
    !Number.isFinite(Date.parse(changedAt)) ||
    Date.parse(changedAt) < Date.parse(after.startedAt)
  ) {
    throw new Error('Checklist change time is invalid');
  }
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE checklist_runs SET completed_at = ?, abandoned_at = ?, state_revision = ?
       WHERE id = ? AND state_revision = ?`,
      after.completedAt,
      after.abandonedAt,
      after.stateRevision,
      after.id,
      before.stateRevision,
    );
    if (result.changes !== 1) throw new Error('Checklist completion state changed elsewhere');
    for (const sequence of beforeSequences) {
      if (!afterSequences.has(sequence)) {
        await transaction.runAsync(
          `DELETE FROM checklist_completions WHERE run_id = ? AND item_sequence = ?`,
          after.id,
          sequence,
        );
      }
    }
    for (const sequence of afterSequences) {
      if (beforeSequences.has(sequence)) continue;
      await transaction.runAsync(
        `INSERT INTO checklist_completions (run_id, item_sequence, completed_at)
         VALUES (?, ?, ?)`,
        after.id,
        sequence,
        changedAt,
      );
    }
  });
};
