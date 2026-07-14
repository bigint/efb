import { describe, expect, it } from 'vitest';

import {
  decodeLogbookRows,
  decodeLogbookSummary,
  type LogbookAggregateRow,
  type LogbookRow,
} from './logbook-repository';

const row: LogbookRow = {
  aircraft_id: null,
  aircraft_registration: 'N123DL',
  approaches: 0,
  arrival_identifier: 'KSEA',
  block_minutes: 90,
  compliance_status: 'not-evaluated',
  created_at: '2026-07-14T10:00:00.000Z',
  day_minutes: 60,
  departure_identifier: 'KPDX',
  dual_minutes: 0,
  flight_date: '2026-07-14',
  flight_minutes: 75,
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  instructor_minutes: 0,
  instrument_minutes: 0,
  jurisdiction: 'UNCLASSIFIED',
  landings_day: 0,
  landings_night: 0,
  night_minutes: 15,
  pic_minutes: 75,
  remarks: '',
  sic_minutes: 0,
  updated_at: '2026-07-14T10:00:00.000Z',
};

describe('logbook SQLite read boundary', () => {
  it('decodes relational rows and attachment references', () => {
    const documentId = '019f5f42-a146-7c00-861d-7ad2313bbbd5';
    expect(
      decodeLogbookRows([row], [{ document_id: documentId, entry_id: row.id }]),
    ).toMatchObject([{ attachmentIds: [documentId], id: row.id }]);
  });

  it('fails closed on a corrupt stored duration', () => {
    expect(() => decodeLogbookRows([{ ...row, flight_minutes: -1 }], [])).toThrow();
  });

  it('fails closed on duplicate attachment relations', () => {
    const attachment = {
      document_id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
      entry_id: row.id,
    };
    expect(() => decodeLogbookRows([row], [attachment, attachment])).toThrow(
      'Attachment references must be unique',
    );
  });

  it('fails closed on an attachment outside the bounded recent page', () => {
    expect(() =>
      decodeLogbookRows(
        [],
        [
          {
            document_id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
            entry_id: row.id,
          },
        ],
      ),
    ).toThrow('unavailable entry');
  });

  it('decodes validated all-time SQL aggregates without compliance claims', () => {
    const aggregate: LogbookAggregateRow = {
      block_minutes: 90,
      day_minutes: 60,
      dual_minutes: 0,
      entry_count: 1,
      flight_minutes: 75,
      instructor_minutes: 0,
      instrument_minutes: 10,
      landings_day: 1,
      landings_night: 0,
      night_minutes: 15,
      pic_minutes: 75,
      sic_minutes: 0,
    };
    expect(decodeLogbookSummary(aggregate, [{ jurisdiction: 'UNCLASSIFIED' }])).toMatchObject({
      entries: 1,
      jurisdictions: ['UNCLASSIFIED'],
      regulatoryComplianceEvaluated: false,
      totals: { flightMinutes: 75, instrumentMinutes: 10 },
    });
    expect(() =>
      decodeLogbookSummary({ ...aggregate, flight_minutes: Number.MAX_SAFE_INTEGER + 1 }, []),
    ).toThrow('aggregate is invalid');
  });
});
