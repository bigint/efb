import {
  logbookComplianceSchema,
  logbookEntrySchema,
  type LogbookEntry,
  type LogbookSummary,
  type LogbookTotals,
} from '@driftline/aviation-domain';
import type { SQLiteDatabase } from 'expo-sqlite';

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

const RECENT_LOGBOOK_ENTRY_LIMIT = 100;
const RECENT_ATTACHMENT_LIMIT = RECENT_LOGBOOK_ENTRY_LIMIT * 20;

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
  const totals = Object.fromEntries(
    (Object.keys(row) as (keyof LogbookAggregateRow)[])
      .filter((key) => key !== 'entry_count')
      .map((key) => [key, requireAggregateInteger(row[key], key)]),
  ) as Record<Exclude<keyof LogbookAggregateRow, 'entry_count'>, number>;
  return {
    entries: requireAggregateInteger(row.entry_count, 'entry count'),
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

export const listLogbookEntries = async (
  database: SQLiteDatabase,
): Promise<readonly LogbookEntry[]> => {
  const [rows, attachmentRows] = await Promise.all([
    database.getAllAsync<LogbookRow>(
      `SELECT * FROM logbook_entries
       ORDER BY flight_date DESC, created_at DESC, id DESC
       LIMIT ${RECENT_LOGBOOK_ENTRY_LIMIT}`,
    ),
    database.getAllAsync<AttachmentRow>(
      `SELECT attachment.entry_id, attachment.document_id
       FROM logbook_entry_attachments AS attachment
       INNER JOIN (
         SELECT id FROM logbook_entries
         ORDER BY flight_date DESC, created_at DESC, id DESC
         LIMIT ${RECENT_LOGBOOK_ENTRY_LIMIT}
       ) AS recent ON recent.id = attachment.entry_id
       ORDER BY attachment.entry_id, attachment.document_id
       LIMIT ${RECENT_ATTACHMENT_LIMIT + 1}`,
    ),
  ]);
  if (attachmentRows.length > RECENT_ATTACHMENT_LIMIT) {
    throw new Error('Recent logbook attachments exceed supported limits');
  }
  return decodeLogbookRows(rows, attachmentRows);
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
  readonly summary: LogbookSummary;
}

export const loadLogbookDashboard = async (
  database: SQLiteDatabase,
): Promise<LogbookDashboard> => {
  const result: { dashboard?: LogbookDashboard } = {};
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const [entries, summary] = await Promise.all([
      listLogbookEntries(transaction),
      loadLogbookSummary(transaction),
    ]);
    result.dashboard = { entries, summary };
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
  const ids = new Set(rows.map(({ id }) => id));
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
