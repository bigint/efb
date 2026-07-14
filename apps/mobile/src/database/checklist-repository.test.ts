import { describe, expect, it } from 'vitest';

import {
  decodeChecklistRun,
  decodeChecklistRuns,
  decodeChecklistTemplates,
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

describe('checklist SQLite read boundary', () => {
  it('decodes templates with ordered relational items', () => {
    expect(decodeChecklistTemplates([templateRow], [itemRow])).toMatchObject([
      { items: [{ challenge: 'User item', sequence: 0 }], title: 'User checklist' },
    ]);
  });

  it('fails closed when a template has no items', () => {
    expect(() => decodeChecklistTemplates([templateRow], [])).toThrow();
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
});
