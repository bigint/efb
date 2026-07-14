import { describe, expect, it } from 'vitest';

import {
  formatLogbookDuration,
  logbookEntrySchema,
  parseLogbookCount,
  parseLogbookDuration,
  summariseLogbook,
  type LogbookEntry,
} from './logbook';

const entry = (overrides: Partial<LogbookEntry> = {}): LogbookEntry =>
  logbookEntrySchema.parse({
    aircraftId: null,
    aircraftRegistration: 'N123DL',
    approaches: 1,
    arrivalIdentifier: 'KSEA',
    attachmentIds: [],
    blockMinutes: 90,
    compliance: { jurisdiction: 'US', status: 'not-evaluated' },
    createdAt: '2026-07-14T10:00:00.000Z',
    dayMinutes: 60,
    departureIdentifier: 'KPDX',
    dualMinutes: 0,
    flightDate: '2026-07-14',
    flightMinutes: 75,
    id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
    instructorMinutes: 0,
    instrumentMinutes: 10,
    landingsDay: 1,
    landingsNight: 0,
    nightMinutes: 15,
    picMinutes: 75,
    remarks: 'Educational fixture',
    sicMinutes: 0,
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  });

describe('logbook domain', () => {
  it('parses bounded whole-number operation counts', () => {
    expect(parseLogbookCount(' 0 ')).toBe(0);
    expect(parseLogbookCount('100')).toBe(100);
    expect(() => parseLogbookCount('01')).toThrow('whole number');
    expect(() => parseLogbookCount('101')).toThrow('whole number');
    expect(() => parseLogbookCount('1.5')).toThrow('whole number');
  });

  it('parses and formats explicit H:MM durations', () => {
    expect(parseLogbookDuration(' 12:05 ')).toBe(725);
    expect(formatLogbookDuration(725)).toBe('12:05');
    expect(formatLogbookDuration(20_000)).toBe('333:20');
    expect(() => parseLogbookDuration('1.5')).toThrow('H:MM');
    expect(() => parseLogbookDuration('1:60')).toThrow('H:MM');
  });

  it('normalises station identifiers and preserves explicit compliance status', () => {
    expect(entry({ arrivalIdentifier: ' ksea ', departureIdentifier: ' kpdx ' })).toMatchObject(
      {
        arrivalIdentifier: 'KSEA',
        compliance: { jurisdiction: 'US', status: 'not-evaluated' },
        departureIdentifier: 'KPDX',
      },
    );
  });

  it.each([
    ['flight beyond block', { blockMinutes: 60, flightMinutes: 61 }],
    ['day plus night beyond flight', { dayMinutes: 61, flightMinutes: 75, nightMinutes: 15 }],
    ['instrument beyond flight', { flightMinutes: 75, instrumentMinutes: 76 }],
    ['combined PIC and SIC beyond flight', { picMinutes: 40, sicMinutes: 40 }],
    ['negative time', { picMinutes: -1 }],
    ['invalid calendar date', { flightDate: '2026-02-30' }],
    [
      'update before creation',
      {
        createdAt: '2026-07-14T10:00:00.000Z',
        updatedAt: '2026-07-14T09:59:59.000Z',
      },
    ],
  ] as const)('rejects %s', (_label, overrides) => {
    expect(() => entry(overrides)).toThrow();
  });

  it('rejects duplicate attachment references', () => {
    const attachment = '019f5f42-a146-7c00-861d-7ad2313bbbd5';
    expect(() => entry({ attachmentIds: [attachment, attachment] })).toThrow(
      'Attachment references must be unique',
    );
  });

  it('summarises additive fields without implying regulatory compliance', () => {
    const second = entry({
      compliance: { jurisdiction: 'IN', status: 'not-evaluated' },
      id: '019f5f42-a146-7c00-861d-7ad2313bbbd6',
      picMinutes: 0,
      sicMinutes: 75,
    });
    expect(summariseLogbook([entry(), second])).toMatchObject({
      entries: 2,
      jurisdictions: ['IN', 'US'],
      regulatoryComplianceEvaluated: false,
      totals: { flightMinutes: 150, picMinutes: 75, sicMinutes: 75 },
    });
  });

  it('refuses duplicate entries in totals', () => {
    const record = entry();
    expect(() => summariseLogbook([record, record])).toThrow('must be unique');
  });
});
