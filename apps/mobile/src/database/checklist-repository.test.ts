import { describe, expect, it } from 'vitest';

import {
  decodeChecklistRun,
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
});
