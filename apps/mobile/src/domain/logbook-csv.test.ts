import { describe, expect, it } from 'vitest';

import { logbookEntrySchema, type LogbookEntry } from '@driftline/aviation-domain';

import { createLogbookCsv, LOGBOOK_CSV_ENTRY_LIMIT } from './logbook-csv';

const entry = (overrides: Partial<LogbookEntry> = {}): LogbookEntry =>
  logbookEntrySchema.parse({
    aircraftId: null,
    aircraftRegistration: 'N123DL',
    approaches: 1,
    arrivalIdentifier: 'KDEN',
    attachmentIds: [],
    blockMinutes: 75,
    compliance: { jurisdiction: 'UNCLASSIFIED', status: 'not-evaluated' },
    createdAt: '2026-07-14T10:00:00.000Z',
    dayMinutes: 60,
    departureIdentifier: 'KCOS',
    dualMinutes: 0,
    flightDate: '2026-07-14',
    flightMinutes: 60,
    id: '019f61a7-f53e-7aa4-a93a-967c478ab2a8',
    instructorMinutes: 0,
    instrumentMinutes: 10,
    landingsDay: 1,
    landingsNight: 0,
    nightMinutes: 0,
    picMinutes: 60,
    remarks: 'Training, "west"',
    sicMinutes: 0,
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  });

describe('logbook CSV export', () => {
  it('preserves integer facts and quotes text deterministically', () => {
    const csv = createLogbookCsv([entry()]);
    expect(csv.startsWith('\uFEFFid,flight_date,')).toBe(true);
    expect(csv).toContain(',75,60,60,0,60,0,0,0,10,1,1,0,');
    expect(csv).toContain('"Training, ""west"""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('neutralizes spreadsheet formula prefixes in every text cell', () => {
    const csv = createLogbookCsv([entry({ remarks: '  =HYPERLINK("x")' })]);
    expect(csv).toContain('"\'  =HYPERLINK(""x"")"');
  });

  it('rejects duplicate and unbounded snapshots', () => {
    const value = entry();
    expect(() => createLogbookCsv([value, value])).toThrow('duplicate');
    expect(() =>
      createLogbookCsv(
        Array.from({ length: LOGBOOK_CSV_ENTRY_LIMIT + 1 }, (_, index) => ({
          ...value,
          id: `019f61a7-f53e-7aa4-a93a-${String(index).padStart(12, '0')}`,
        })),
      ),
    ).toThrow('at most');
  });
});
