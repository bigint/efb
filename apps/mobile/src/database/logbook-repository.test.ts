import { describe, expect, it } from 'vitest';

import {
  decodeLogbookRows,
  decodeLogbookSummary,
  listLogbookEntriesPage,
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

  it('uses a validated exclusive keyset cursor for older pages', async () => {
    const calls: { params: readonly unknown[]; sql: string }[] = [];
    const database = {
      getAllAsync: (sql: string, ...params: readonly unknown[]) => {
        calls.push({ params, sql });
        return Promise.resolve([]);
      },
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    await expect(
      listLogbookEntriesPage(database as never, {
        createdAt: row.created_at,
        flightDate: row.flight_date,
        id: row.id,
      }),
    ).resolves.toEqual({ entries: [], nextCursor: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('flight_date < ?');
    expect(calls[0]?.params).toEqual([
      row.flight_date,
      row.flight_date,
      row.created_at,
      row.flight_date,
      row.created_at,
      row.id,
    ]);
  });

  it('rejects malformed paging cursors before querying storage', async () => {
    let queried = false;
    const database = {
      getAllAsync: () => {
        queried = true;
        return Promise.resolve([]);
      },
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    await expect(
      listLogbookEntriesPage(database as never, {
        createdAt: row.created_at,
        flightDate: '2026-99-99',
        id: row.id,
      }),
    ).rejects.toThrow();
    expect(queried).toBe(false);
  });

  it('returns a cursor after 100 validated rows and bounds the attachment lookup', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...row,
      id: `019f5f42-a146-7c00-861d-${String(999_999_999_999 - index).padStart(12, '0')}`,
    }));
    const calls: { params: readonly unknown[]; sql: string }[] = [];
    const database = {
      getAllAsync: (sql: string, ...params: readonly unknown[]) => {
        calls.push({ params, sql });
        return Promise.resolve(calls.length === 1 ? rows : []);
      },
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    const page = await listLogbookEntriesPage(database as never, {
      createdAt: '2026-07-15T10:00:00.000Z',
      flightDate: '2026-07-15',
      id: '019f5f42-a146-7c00-861d-999999999999',
    });
    expect(page.entries).toHaveLength(100);
    expect(page.nextCursor?.id).toBe(rows[99]?.id);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.sql).toContain('LIMIT 2001');
    expect(calls[1]?.params).toHaveLength(100);
    expect(calls[1]?.params).not.toContain(rows[100]?.id);
  });
});
