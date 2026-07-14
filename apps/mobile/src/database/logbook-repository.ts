import { logbookEntrySchema, type LogbookEntry } from '@driftline/aviation-domain';
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
      `SELECT * FROM logbook_entries ORDER BY flight_date DESC, created_at DESC`,
    ),
    database.getAllAsync<AttachmentRow>(
      `SELECT entry_id, document_id FROM logbook_entry_attachments ORDER BY document_id`,
    ),
  ]);
  return decodeLogbookRows(rows, attachmentRows);
};

export const decodeLogbookRows = (
  rows: readonly LogbookRow[],
  attachmentRows: readonly AttachmentRow[],
): readonly LogbookEntry[] => {
  const attachments = new Map<string, string[]>();
  for (const row of attachmentRows) {
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
