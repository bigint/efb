import { describe, expect, it } from 'vitest';

import {
  checklistTemplateSchema,
  setChecklistItemCompleted,
  startChecklistRun,
  type ChecklistTemplate,
} from './checklist';

const template = (overrides: Partial<ChecklistTemplate> = {}): ChecklistTemplate =>
  checklistTemplateSchema.parse({
    aircraftId: null,
    aircraftLabel: 'Generic demonstration aircraft',
    category: 'normal',
    createdAt: '2026-07-14T10:00:00.000Z',
    id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
    items: [
      {
        challenge: 'Example switch',
        isCritical: false,
        response: 'Example position',
        sequence: 0,
      },
      { challenge: 'Example indication', isCritical: true, response: 'Checked', sequence: 1 },
    ],
    revision: 1,
    source: 'generic-demonstration',
    title: 'Demonstration only',
    updatedAt: '2026-07-14T10:00:00.000Z',
    verificationStatus: 'unverified',
    ...overrides,
  });

describe('checklist domain', () => {
  it('requires contiguous item sequences and immutable unverified provenance', () => {
    expect(() =>
      template({
        items: [{ challenge: 'Test', isCritical: false, response: 'Test', sequence: 1 }],
      }),
    ).toThrow('contiguous');
    expect(() =>
      checklistTemplateSchema.parse({ ...template(), verificationStatus: 'verified' }),
    ).toThrow();
  });

  it('starts a run with an immutable template revision snapshot', () => {
    expect(
      startChecklistRun(
        template(),
        '019f5f42-a146-7c00-861d-7ad2313bbbd5',
        '2026-07-14T11:00:00.000Z',
      ),
    ).toMatchObject({
      completedAt: null,
      completedSequences: [],
      itemCount: 2,
      stateRevision: 1,
      templateRevision: 1,
    });
  });

  it('completes only when every snapshot item is checked', () => {
    let run = startChecklistRun(
      template(),
      '019f5f42-a146-7c00-861d-7ad2313bbbd5',
      '2026-07-14T11:00:00.000Z',
    );
    run = setChecklistItemCompleted(run, 1, true, '2026-07-14T11:01:00.000Z');
    expect(run).toMatchObject({ completedAt: null, completedSequences: [1] });
    expect(run.stateRevision).toBe(2);
    run = setChecklistItemCompleted(run, 0, true, '2026-07-14T11:02:00.000Z');
    expect(run).toMatchObject({
      completedAt: '2026-07-14T11:02:00.000Z',
      completedSequences: [0, 1],
      stateRevision: 3,
    });
    expect(() => setChecklistItemCompleted(run, 0, false, '2026-07-14T11:03:00.000Z')).toThrow(
      'immutable',
    );
  });

  it('rejects out-of-range items and chronology reversal', () => {
    const run = startChecklistRun(
      template(),
      '019f5f42-a146-7c00-861d-7ad2313bbbd5',
      '2026-07-14T11:00:00.000Z',
    );
    expect(() => setChecklistItemCompleted(run, 2, true, '2026-07-14T11:01:00.000Z')).toThrow(
      RangeError,
    );
    expect(() => setChecklistItemCompleted(run, 0, true, '2026-07-14T10:59:00.000Z')).toThrow(
      'invalid',
    );
  });
});
