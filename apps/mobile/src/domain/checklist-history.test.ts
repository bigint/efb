import { describe, expect, it } from 'vitest';

import {
  abandonChecklistRun,
  checklistTemplateSchema,
  setChecklistItemCompleted,
  startChecklistRun,
} from '@driftline/aviation-domain';

import { presentChecklistHistory } from './checklist-history';

const template = checklistTemplateSchema.parse({
  aircraftId: null,
  aircraftLabel: 'TEST SOURCE',
  category: 'normal',
  createdAt: '2026-07-14T10:00:00.000Z',
  id: '019f61a7-f53e-7aa4-a93a-967c478ab2a8',
  items: [
    { challenge: 'First', isCritical: true, response: 'Checked', sequence: 0 },
    { challenge: 'Second', isCritical: false, response: 'Set', sequence: 1 },
  ],
  revision: 3,
  source: 'user-authored',
  title: 'Fixture checklist',
  updatedAt: '2026-07-14T10:00:00.000Z',
  verificationStatus: 'unverified',
});

describe('checklist history presentation', () => {
  it('maps immutable completed item outcomes and elapsed time', () => {
    const started = startChecklistRun(
      template,
      '019f61a7-f53e-7aa4-a93a-967c478ab2a9',
      '2026-07-14T11:00:00.000Z',
    );
    const first = setChecklistItemCompleted(started, 0, true, '2026-07-14T11:01:00.000Z');
    const completed = setChecklistItemCompleted(first, 1, true, '2026-07-14T11:02:30.000Z');
    expect(presentChecklistHistory(completed)).toMatchObject({
      elapsedSeconds: 150,
      items: [{ completed: true }, { completed: true }],
      status: 'completed',
      terminalAt: '2026-07-14T11:02:30.000Z',
    });
  });

  it('preserves unchecked items in an abandoned snapshot', () => {
    const started = startChecklistRun(
      template,
      '019f61a7-f53e-7aa4-a93a-967c478ab2aa',
      '2026-07-14T11:00:00.000Z',
    );
    const first = setChecklistItemCompleted(started, 0, true, '2026-07-14T11:01:00.000Z');
    const abandoned = abandonChecklistRun(first, '2026-07-14T11:03:00.000Z');
    expect(presentChecklistHistory(abandoned)).toMatchObject({
      items: [{ completed: true }, { completed: false }],
      status: 'abandoned',
    });
  });

  it('rejects an open run', () => {
    const started = startChecklistRun(
      template,
      '019f61a7-f53e-7aa4-a93a-967c478ab2ab',
      '2026-07-14T11:00:00.000Z',
    );
    expect(() => presentChecklistHistory(started)).toThrow('terminal');
  });
});
