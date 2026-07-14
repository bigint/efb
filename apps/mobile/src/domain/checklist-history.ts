import { checklistRunSchema, type ChecklistRun } from '@driftline/aviation-domain';

export interface ChecklistHistoryPresentation {
  readonly elapsedSeconds: number;
  readonly items: readonly {
    readonly challenge: string;
    readonly completed: boolean;
    readonly isCritical: boolean;
    readonly response: string;
    readonly sequence: number;
  }[];
  readonly status: 'abandoned' | 'completed';
  readonly terminalAt: string;
}

export const presentChecklistHistory = (source: ChecklistRun): ChecklistHistoryPresentation => {
  const run = checklistRunSchema.parse(source);
  const terminalAt = run.completedAt ?? run.abandonedAt;
  if (terminalAt === null) throw new Error('Checklist history requires a terminal run');
  const elapsedSeconds = Math.floor(
    (Date.parse(terminalAt) - Date.parse(run.startedAt)) / 1_000,
  );
  if (!Number.isSafeInteger(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error('Checklist history elapsed time is invalid');
  }
  const completed = new Set(run.completedSequences);
  return {
    elapsedSeconds,
    items: run.templateSnapshot.items.map((item) => ({
      challenge: item.challenge,
      completed: completed.has(item.sequence),
      isCritical: item.isCritical,
      response: item.response,
      sequence: item.sequence,
    })),
    status: run.completedAt === null ? 'abandoned' : 'completed',
    terminalAt,
  };
};
