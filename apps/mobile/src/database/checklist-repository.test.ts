import { describe, expect, it } from 'vitest';

import {
  decodeChecklistRun,
  decodeChecklistRuns,
  decodeChecklistTemplates,
  listRecentTerminalChecklistRuns,
  listChecklistTemplates,
  loadLatestOpenChecklistRun,
  replaceChecklistTemplate,
  type ChecklistItemRow,
  type ChecklistTemplateRow,
} from './checklist-repository';

const templateRow: ChecklistTemplateRow = {
  aircraft_id: null,
  aircraft_label: 'User aircraft',
  category: 'normal',
  created_at: '2026-07-14T10:00:00.000Z',
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  revision: 1,
  source: 'user-authored',
  title: 'User checklist',
  updated_at: '2026-07-14T10:00:00.000Z',
  verification_status: 'unverified',
};

const itemRow: ChecklistItemRow = {
  challenge: 'User item',
  is_critical: 0,
  response: 'User response',
  sequence: 0,
  template_id: templateRow.id,
};

const revisedTemplate = () => ({
  aircraftId: null,
  aircraftLabel: templateRow.aircraft_label,
  category: templateRow.category,
  createdAt: templateRow.created_at,
  id: templateRow.id,
  items: [
    {
      challenge: itemRow.challenge,
      isCritical: false,
      response: itemRow.response,
      sequence: 0,
    },
  ],
  revision: 2,
  source: templateRow.source,
  title: 'Revised checklist',
  updatedAt: '2026-07-14T10:01:00.000Z',
  verificationStatus: templateRow.verification_status,
});

describe('checklist SQLite read boundary', () => {
  it('decodes templates with ordered relational items', () => {
    expect(decodeChecklistTemplates([templateRow], [itemRow])).toMatchObject([
      { items: [{ challenge: 'User item', sequence: 0 }], title: 'User checklist' },
    ]);
  });

  it('fails closed when a template has no items', () => {
    expect(() => decodeChecklistTemplates([templateRow], [])).toThrow();
  });

  it('reconstructs templates and items in one exclusive snapshot', async () => {
    let transactionCount = 0;
    const database = {
      getAllAsync: (sql: string) =>
        Promise.resolve(sql.includes('FROM checklist_templates') ? [templateRow] : [itemRow]),
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) => {
        transactionCount += 1;
        return operation(database);
      },
    };
    await expect(listChecklistTemplates(database as never)).resolves.toHaveLength(1);
    expect(transactionCount).toBe(1);
  });

  it('rejects invalid SQLite boolean encodings', () => {
    expect(() =>
      decodeChecklistTemplates([templateRow], [{ ...itemRow, is_critical: 2 }]),
    ).toThrow('critical flag');
  });

  it('fails closed on malformed run snapshots', () => {
    expect(() =>
      decodeChecklistRun(
        {
          abandoned_at: null,
          completed_at: null,
          id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
          item_count: 1,
          started_at: '2026-07-14T11:00:00.000Z',
          state_revision: 1,
          template_id: templateRow.id,
          template_revision: 1,
          template_snapshot_json: '{broken',
        },
        [],
      ),
    ).toThrow('not valid JSON');
  });

  it('groups completed history by run without changing row order', () => {
    const snapshot = {
      aircraftId: null,
      aircraftLabel: templateRow.aircraft_label,
      category: templateRow.category,
      createdAt: templateRow.created_at,
      id: templateRow.id,
      items: [
        { challenge: 'User item', isCritical: false, response: 'User response', sequence: 0 },
      ],
      revision: 1,
      source: templateRow.source,
      title: templateRow.title,
      updatedAt: templateRow.updated_at,
      verificationStatus: templateRow.verification_status,
    } as const;
    const completed = {
      abandoned_at: null,
      completed_at: '2026-07-14T11:01:00.000Z',
      id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
      item_count: 1,
      started_at: '2026-07-14T11:00:00.000Z',
      state_revision: 2,
      template_id: templateRow.id,
      template_revision: 1,
      template_snapshot_json: JSON.stringify(snapshot),
    };
    expect(
      decodeChecklistRuns([completed], [{ item_sequence: 0, run_id: completed.id }]),
    ).toMatchObject([{ completedAt: completed.completed_at, completedSequences: [0] }]);
  });

  it('rejects history completions that reference a run outside the bounded read', () => {
    expect(() =>
      decodeChecklistRuns(
        [],
        [{ item_sequence: 0, run_id: '019f5f42-a146-7c00-861d-7ad2313bbbd5' }],
      ),
    ).toThrow('unavailable run');
  });

  it('replaces template fields and items in one compare-and-swap transaction', async () => {
    const statements: string[] = [];
    const database = {
      runAsync: (sql: string) => {
        statements.push(sql);
        return Promise.resolve({ changes: 1 });
      },
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    await replaceChecklistTemplate(database as never, 1, revisedTemplate());
    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain('revision = ?');
    expect(statements[0]).toContain('WHERE id = ? AND revision = ?');
    expect(statements[1]).toContain('DELETE FROM checklist_items');
    expect(statements[2]).toContain('INSERT INTO checklist_items');
  });

  it('does not replace items after a stale template revision', async () => {
    const statements: string[] = [];
    const database = {
      runAsync: (sql: string) => {
        statements.push(sql);
        return Promise.resolve({ changes: 0 });
      },
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    await expect(
      replaceChecklistTemplate(database as never, 1, revisedTemplate()),
    ).rejects.toThrow('another writer');
    expect(statements).toHaveLength(1);
  });

  it('stops an unbounded open-run completion collection before decoding', async () => {
    const database = {
      getAllAsync: () =>
        Promise.resolve(Array.from({ length: 101 }, (_, item_sequence) => ({ item_sequence }))),
      getFirstAsync: () =>
        Promise.resolve({
          abandoned_at: null,
          completed_at: null,
          id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
          item_count: 1,
          started_at: '2026-07-14T11:00:00.000Z',
          state_revision: 1,
          template_id: templateRow.id,
          template_revision: 1,
          template_snapshot_json: '{}',
        }),
    };
    await expect(loadLatestOpenChecklistRun(database as never)).rejects.toThrow(
      'supported limits',
    );
  });

  it('stops unbounded terminal-run completions inside the snapshot transaction', async () => {
    let read = 0;
    const database = {
      getAllAsync: () => {
        read += 1;
        return Promise.resolve(
          read === 1
            ? [
                {
                  abandoned_at: '2026-07-14T11:01:00.000Z',
                  completed_at: null,
                  id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
                  item_count: 1,
                  started_at: '2026-07-14T11:00:00.000Z',
                  state_revision: 2,
                  template_id: templateRow.id,
                  template_revision: 1,
                  template_snapshot_json: '{}',
                },
              ]
            : Array.from({ length: 2_001 }, (_, item_sequence) => ({
                item_sequence,
                run_id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
              })),
        );
      },
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    await expect(listRecentTerminalChecklistRuns(database as never)).rejects.toThrow(
      'supported limits',
    );
  });
});
