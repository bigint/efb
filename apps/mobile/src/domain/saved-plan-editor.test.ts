import { describe, expect, it } from 'vitest';

import { parseSavedPlanEditor } from './saved-plan-editor';

const fixture = () => ({
  aircraftId: null,
  altitudeFeet: '',
  departureTime: '',
  notes: '',
  title: ' Demo route ',
});

describe('saved plan editor boundary', () => {
  it('normalises optional details without inventing values', () => {
    expect(parseSavedPlanEditor(fixture())).toEqual({
      aircraftId: null,
      altitudeFeet: null,
      departureTime: null,
      notes: '',
      title: 'Demo route',
    });
  });

  it('accepts bounded whole-foot altitude and UTC ISO departure time', () => {
    expect(
      parseSavedPlanEditor({
        ...fixture(),
        altitudeFeet: ' 12500 ',
        departureTime: '2026-07-14T12:30:00Z',
      }),
    ).toMatchObject({ altitudeFeet: 12_500, departureTime: '2026-07-14T12:30:00Z' });
  });

  it.each(['-1', '12.5', '01', '60001', 'Infinity'])(
    'rejects ambiguous altitude %s',
    (value) => {
      expect(() => parseSavedPlanEditor({ ...fixture(), altitudeFeet: value })).toThrow(
        'whole number',
      );
    },
  );

  it.each([
    '2026-07-14',
    'July 14, 2026 12:30',
    '2026-07-14T12:30:00+05:30',
    '2026-02-30T12:30:00Z',
  ])('rejects ambiguous or invalid departure time %s', (value) => {
    expect(() => parseSavedPlanEditor({ ...fixture(), departureTime: value })).toThrow(
      'UTC ISO',
    );
  });

  it('requires a nonblank title', () => {
    expect(() => parseSavedPlanEditor({ ...fixture(), title: '  ' })).toThrow('required');
  });
});
