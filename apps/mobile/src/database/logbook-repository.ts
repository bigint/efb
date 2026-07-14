import {
  logbookComplianceSchema,
  logbookEntrySchema,
  type LogbookEntry,
  type LogbookSummary,
  type LogbookTotals,
} from '@driftline/aviation-domain';
import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

export interface LogbookRow {
  readonly aircraft_id: string | null;
  readonly aircraft_registration: string;
  readonly approaches: number;
  readonly arrival_identifier: string;
  readonly block_minutes: number;
  readonly compliance_status: 'not-evaluated';
  readonly created_at: string;
  readonly day_minutes: number;
  readonly departure_identifier: string;
  readonly dual_minutes: number;
  readonly flight_date: string;
  readonly flight_minutes: number;
  readonly id: string;
  readonly instructor_minutes: number;
  readonly instrument_minutes: number;
  readonly jurisdiction: string;
  readonly landings_day: number;
  readonly landings_night: number;
  readonly night_minutes: number;
  readonly pic_minutes: number;
  readonly remarks: string;
  readonly sic_minutes: number;
  readonly updated_at: string;
}

export interface AttachmentRow {
  readonly document_id: string;
  readonly entry_id: string;
}

export interface LogbookAggregateRow {
  readonly block_minutes: number;
  readonly day_minutes: number;
  readonly dual_minutes: number;
  readonly entry_count: number;
  readonly flight_minutes: number;
  readonly instructor_minutes: number;
  readonly instrument_minutes: number;
  readonly landings_day: number;
  readonly landings_night: number;
  readonly night_minutes: number;
  readonly pic_minutes: number;
  readonly sic_minutes: number;
}

const LOGBOOK_PAGE_LIMIT = 100;
const PAGE_ATTACHMENT_LIMIT = LOGBOOK_PAGE_LIMIT * 20;

const logbookPageCursorSchema = z
  .object({
    createdAt: z.iso.datetime(),
    flightDate: z.iso.date(),
    id: z.uuid(),
  })
  .strict();

export type LogbookPageCursor = z.infer<typeof logbookPageCursorSchema>;

export interface LogbookPage {
  readonly entries: readonly LogbookEntry[];
  readonly nextCursor: LogbookPageCursor | null;
}

const requireAggregateInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Logbook ${label} aggregate is invalid`);
  }
  return value;
};

export const decodeLogbookSummary = (
  row: LogbookAggregateRow,
  jurisdictionRows: readonly { readonly jurisdiction: string }[],
): LogbookSummary => {
  if (jurisdictionRows.length > 100) {
    throw new Error('Logbook jurisdiction collection exceeds supported limits');
  }
  const jurisdictionSet = new Set(jurisdictionRows.map(({ jurisdiction }) => jurisdiction));
  if (jurisdictionSet.size !== jurisdictionRows.length) {
    throw new Error('Logbook jurisdiction collection contains duplicates');
  }
  const totals = Object.fromEntries(
    (Object.keys(row) as (keyof LogbookAggregateRow)[])
      .filter((key) => key !== 'entry_count')
      .map((key) => [key, requireAggregateInteger(row[key], key)]),
  ) as Record<Exclude<keyof LogbookAggregateRow, 'entry_count'>, number>;
  const entries = requireAggregateInteger(row.entry_count, 'entry count');
  if (
    totals.flight_minutes > totals.block_minutes ||
    totals.day_minutes + totals.night_minutes > totals.flight_minutes ||
    totals.pic_minutes + totals.sic_minutes > totals.flight_minutes ||
    totals.dual_minutes > totals.flight_minutes ||
    totals.instructor_minutes > totals.flight_minutes ||
    totals.instrument_minutes > totals.flight_minutes ||
    (entries === 0 && Object.values(totals).some((value) => value !== 0))
  ) {
    throw new Error('Logbook aggregates contradict entry invariants');
  }
  return {
    entries,
    jurisdictions: jurisdictionRows.map(
      ({ jurisdiction }) =>
        logbookComplianceSchema.parse({ jurisdiction, status: 'not-evaluated' }).jurisdiction,
    ),
    regulatoryComplianceEvaluated: false,
    totals: {
      blockMinutes: totals.block_minutes,
      dayMinutes: totals.day_minutes,
      dualMinutes: totals.dual_minutes,
      flightMinutes: totals.flight_minutes,
      instructorMinutes: totals.instructor_minutes,
      instrumentMinutes: totals.instrument_minutes,
      landingsDay: totals.landings_day,
      landingsNight: totals.landings_night,
      nightMinutes: totals.night_minutes,
      picMinutes: totals.pic_minutes,
      sicMinutes: totals.sic_minutes,
    } satisfies LogbookTotals,
  };
};

const parseRow = (
  row: LogbookRow,
  attachments: ReadonlyMap<string, readonly string[]>,
): LogbookEntry =>
  logbookEntrySchema.parse({
    aircraftId: row.aircraft_id,
    aircraftRegistration: row.aircraft_registration,
    approaches: row.approaches,
    arrivalIdentifier: row.arrival_identifier,
    attachmentIds: attachments.get(row.id) ?? [],
    blockMinutes: row.block_minutes,
    compliance: { jurisdiction: row.jurisdiction, status: row.compliance_status },
    createdAt: row.created_at,
    dayMinutes: row.day_minutes,
    departureIdentifier: row.departure_identifier,
    dualMinutes: row.dual_minutes,
    flightDate: row.flight_date,
    flightMinutes: row.flight_minutes,
    id: row.id,
    instructorMinutes: row.instructor_minutes,
    instrumentMinutes: row.instrument_minutes,
    landingsDay: row.landings_day,
    landingsNight: row.landings_night,
    nightMinutes: row.night_minutes,
    picMinutes: row.pic_minutes,
    remarks: row.remarks,
    sicMinutes: row.sic_minutes,
    updatedAt: row.updated_at,
  });

const queryLogbookPage = async (
  database: SQLiteDatabase,
  sourceCursor: LogbookPageCursor | null,
): Promise<LogbookPage> => {
  const cursor = sourceCursor === null ? null : logbookPageCursorSchema.parse(sourceCursor);
  const rows = await database.getAllAsync<LogbookRow>(
    `SELECT * FROM logbook_entries
     ${
       cursor === null
         ? ''
         : `WHERE flight_date < ?
            OR (flight_date = ? AND created_at < ?)
            OR (flight_date = ? AND created_at = ? AND id < ?)`
     }
     ORDER BY flight_date DESC, created_at DESC, id DESC
     LIMIT ${LOGBOOK_PAGE_LIMIT + 1}`,
    ...(cursor === null
      ? []
      : [
          cursor.flightDate,
          cursor.flightDate,
          cursor.createdAt,
          cursor.flightDate,
          cursor.createdAt,
          cursor.id,
        ]),
  );
  const pageRows = rows.slice(0, LOGBOOK_PAGE_LIMIT);
  const ids = pageRows.map(({ id }) => id);
  const attachmentRows =
    ids.length === 0
      ? []
      : await database.getAllAsync<AttachmentRow>(
          `SELECT entry_id, document_id
           FROM logbook_entry_attachments
           WHERE entry_id IN (${ids.map(() => '?').join(', ')})
           ORDER BY entry_id, document_id
           LIMIT ${PAGE_ATTACHMENT_LIMIT + 1}`,
          ...ids,
        );
  if (attachmentRows.length > PAGE_ATTACHMENT_LIMIT) {
    throw new Error('Logbook page attachments exceed supported limits');
  }
  const entries = decodeLogbookRows(pageRows, attachmentRows);
  const last = entries.at(-1);
  return {
    entries,
    nextCursor:
      rows.length > LOGBOOK_PAGE_LIMIT && last !== undefined
        ? { createdAt: last.createdAt, flightDate: last.flightDate, id: last.id }
        : null,
  };
};

export const listLogbookEntriesPage = async (
  database: SQLiteDatabase,
  cursor: LogbookPageCursor,
): Promise<LogbookPage> => {
  const result: { page?: LogbookPage } = {};
  await database.withExclusiveTransactionAsync(async (transaction) => {
    result.page = await queryLogbookPage(transaction, cursor);
  });
  if (result.page === undefined) throw new Error('Logbook page transaction produced no result');
  return result.page;
};

export const loadLogbookSummary = async (database: SQLiteDatabase): Promise<LogbookSummary> => {
  const [row, jurisdictions] = await Promise.all([
    database.getFirstAsync<LogbookAggregateRow>(
      `SELECT
        count(*) AS entry_count,
        COALESCE(sum(block_minutes), 0) AS block_minutes,
        COALESCE(sum(day_minutes), 0) AS day_minutes,
        COALESCE(sum(dual_minutes), 0) AS dual_minutes,
        COALESCE(sum(flight_minutes), 0) AS flight_minutes,
        COALESCE(sum(instructor_minutes), 0) AS instructor_minutes,
        COALESCE(sum(instrument_minutes), 0) AS instrument_minutes,
        COALESCE(sum(landings_day), 0) AS landings_day,
        COALESCE(sum(landings_night), 0) AS landings_night,
        COALESCE(sum(night_minutes), 0) AS night_minutes,
        COALESCE(sum(pic_minutes), 0) AS pic_minutes,
        COALESCE(sum(sic_minutes), 0) AS sic_minutes
       FROM logbook_entries`,
    ),
    database.getAllAsync<{ readonly jurisdiction: string }>(
      `SELECT DISTINCT jurisdiction FROM logbook_entries ORDER BY jurisdiction LIMIT 101`,
    ),
  ]);
  if (row === null) throw new Error('Logbook summary query returned no row');
  return decodeLogbookSummary(row, jurisdictions);
};

export interface LogbookDashboard {
  readonly entries: readonly LogbookEntry[];
  readonly nextCursor: LogbookPageCursor | null;
  readonly summary: LogbookSummary;
}

export const loadLogbookDashboard = async (
  database: SQLiteDatabase,
): Promise<LogbookDashboard> => {
  const result: { dashboard?: LogbookDashboard } = {};
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const [page, summary] = await Promise.all([
      queryLogbookPage(transaction, null),
      loadLogbookSummary(transaction),
    ]);
    result.dashboard = { entries: page.entries, nextCursor: page.nextCursor, summary };
  });
  if (result.dashboard === undefined) {
    throw new Error('Logbook dashboard transaction produced no result');
  }
  return result.dashboard;
};

export const decodeLogbookRows = (
  rows: readonly LogbookRow[],
  attachmentRows: readonly AttachmentRow[],
): readonly LogbookEntry[] => {
  if (rows.length > LOGBOOK_PAGE_LIMIT || attachmentRows.length > PAGE_ATTACHMENT_LIMIT) {
    throw new Error('Logbook page exceeds supported limits');
  }
  const ids = new Set(rows.map(({ id }) => id));
  if (ids.size !== rows.length) throw new Error('Logbook page contains duplicate entries');
  const attachments = new Map<string, string[]>();
  for (const row of attachmentRows) {
    if (!ids.has(row.entry_id)) {
      throw new Error('Logbook attachment references an unavailable entry');
    }
    const current = attachments.get(row.entry_id) ?? [];
    current.push(row.document_id);
    attachments.set(row.entry_id, current);
  }
  return rows.map((row) => parseRow(row, attachments));
};

export const insertLogbookEntry = async (
  database: SQLiteDatabase,
  source: LogbookEntry,
): Promise<void> => {
  const entry = logbookEntrySchema.parse(source);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO logbook_entries (
        id, created_at, updated_at, flight_date, jurisdiction, aircraft_id,
        aircraft_registration, departure_identifier, arrival_identifier, block_minutes,
        flight_minutes, day_minutes, pic_minutes, sic_minutes, dual_minutes,
        instructor_minutes, night_minutes, instrument_minutes, approaches,
        landings_day, landings_night, remarks, compliance_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.id,
      entry.createdAt,
      entry.updatedAt,
      entry.flightDate,
      entry.compliance.jurisdiction,
      entry.aircraftId,
      entry.aircraftRegistration,
      entry.departureIdentifier,
      entry.arrivalIdentifier,
      entry.blockMinutes,
      entry.flightMinutes,
      entry.dayMinutes,
      entry.picMinutes,
      entry.sicMinutes,
      entry.dualMinutes,
      entry.instructorMinutes,
      entry.nightMinutes,
      entry.instrumentMinutes,
      entry.approaches,
      entry.landingsDay,
      entry.landingsNight,
      entry.remarks,
      entry.compliance.status,
    );
    for (const documentId of entry.attachmentIds) {
      await transaction.runAsync(
        `INSERT INTO logbook_entry_attachments (entry_id, document_id, created_at)
         VALUES (?, ?, ?)`,
        entry.id,
        documentId,
        entry.createdAt,
      );
    }
  });
};
