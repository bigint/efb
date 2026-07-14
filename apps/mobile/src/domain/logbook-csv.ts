import { logbookEntrySchema, type LogbookEntry } from '@driftline/aviation-domain';

export const LOGBOOK_CSV_ENTRY_LIMIT = 2_000;

const headers = [
  'id',
  'flight_date',
  'created_at_utc',
  'updated_at_utc',
  'jurisdiction',
  'compliance_status',
  'aircraft_id',
  'aircraft_registration',
  'departure_identifier',
  'arrival_identifier',
  'block_minutes',
  'flight_minutes',
  'day_minutes',
  'night_minutes',
  'pic_minutes',
  'sic_minutes',
  'dual_minutes',
  'instructor_minutes',
  'instrument_minutes',
  'approaches',
  'landings_day',
  'landings_night',
  'remarks',
  'attachment_ids',
] as const;

const textCell = (value: string): string => {
  const spreadsheetSafe = /^[\t\r\n ]*[+\-=@]/u.test(value) ? `'${value}` : value;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
};

const rowForEntry = (entry: LogbookEntry): string =>
  [
    textCell(entry.id),
    textCell(entry.flightDate),
    textCell(entry.createdAt),
    textCell(entry.updatedAt),
    textCell(entry.compliance.jurisdiction),
    textCell(entry.compliance.status),
    textCell(entry.aircraftId ?? ''),
    textCell(entry.aircraftRegistration),
    textCell(entry.departureIdentifier),
    textCell(entry.arrivalIdentifier),
    entry.blockMinutes,
    entry.flightMinutes,
    entry.dayMinutes,
    entry.nightMinutes,
    entry.picMinutes,
    entry.sicMinutes,
    entry.dualMinutes,
    entry.instructorMinutes,
    entry.instrumentMinutes,
    entry.approaches,
    entry.landingsDay,
    entry.landingsNight,
    textCell(entry.remarks),
    textCell(entry.attachmentIds.join(';')),
  ].join(',');

export const createLogbookCsv = (source: readonly LogbookEntry[]): string => {
  if (source.length > LOGBOOK_CSV_ENTRY_LIMIT) {
    throw new RangeError(
      `Logbook CSV export supports at most ${LOGBOOK_CSV_ENTRY_LIMIT} entries.`,
    );
  }
  const entries = source.map((entry) => logbookEntrySchema.parse(entry));
  if (new Set(entries.map(({ id }) => id)).size !== entries.length) {
    throw new Error('Logbook CSV export contains duplicate entry identifiers.');
  }
  return `\uFEFF${headers.join(',')}\r\n${entries.map(rowForEntry).join('\r\n')}${entries.length === 0 ? '' : '\r\n'}`;
};
