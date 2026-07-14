import { z } from 'zod';

const MAX_ENTRY_MINUTES = 7 * 24 * 60;

const minutesSchema = z.number().int().min(0).max(MAX_ENTRY_MINUTES);
const hasNoUnsafeRemarkCharacters = (value: string): boolean =>
  [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
  });

export const logbookComplianceSchema = z
  .object({
    jurisdiction: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Z0-9-]+$/u),
    status: z.literal('not-evaluated'),
  })
  .strict();

export const logbookEntrySchema = z
  .object({
    aircraftId: z.uuid().nullable(),
    aircraftRegistration: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{1,16}$/u),
    approaches: z.number().int().min(0).max(100),
    attachmentIds: z.array(z.uuid()).max(20),
    blockMinutes: minutesSchema,
    compliance: logbookComplianceSchema,
    createdAt: z.iso.datetime(),
    dayMinutes: minutesSchema,
    departureIdentifier: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{2,12}$/u),
    dualMinutes: minutesSchema,
    flightDate: z.iso.date(),
    flightMinutes: minutesSchema,
    id: z.uuid(),
    instructorMinutes: minutesSchema,
    instrumentMinutes: minutesSchema,
    landingsDay: z.number().int().min(0).max(100),
    landingsNight: z.number().int().min(0).max(100),
    nightMinutes: minutesSchema,
    picMinutes: minutesSchema,
    remarks: z
      .string()
      .max(5_000)
      .refine(hasNoUnsafeRemarkCharacters, 'Logbook remarks have unsupported controls'),
    sicMinutes: minutesSchema,
    updatedAt: z.iso.datetime(),
    arrivalIdentifier: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{2,12}$/u),
  })
  .strict()
  .superRefine((entry, context) => {
    const mustNotExceedFlight = [
      ['dayMinutes', entry.dayMinutes],
      ['dualMinutes', entry.dualMinutes],
      ['instructorMinutes', entry.instructorMinutes],
      ['instrumentMinutes', entry.instrumentMinutes],
      ['nightMinutes', entry.nightMinutes],
      ['picMinutes', entry.picMinutes],
      ['sicMinutes', entry.sicMinutes],
    ] as const;
    if (entry.flightMinutes > entry.blockMinutes) {
      context.addIssue({
        code: 'custom',
        message: 'Flight time cannot exceed block time',
        path: ['flightMinutes'],
      });
    }
    if (entry.dayMinutes + entry.nightMinutes > entry.flightMinutes) {
      context.addIssue({
        code: 'custom',
        message: 'Combined day and night time cannot exceed flight time',
        path: ['nightMinutes'],
      });
    }
    if (entry.picMinutes + entry.sicMinutes > entry.flightMinutes) {
      context.addIssue({
        code: 'custom',
        message: 'Combined PIC and SIC time cannot exceed flight time',
        path: ['sicMinutes'],
      });
    }
    for (const [field, value] of mustNotExceedFlight) {
      if (value > entry.flightMinutes) {
        context.addIssue({
          code: 'custom',
          message: `${field} cannot exceed flight time`,
          path: [field],
        });
      }
    }
    if (new Set(entry.attachmentIds).size !== entry.attachmentIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Attachment references must be unique',
        path: ['attachmentIds'],
      });
    }
    if (Date.parse(entry.updatedAt) < Date.parse(entry.createdAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Updated time cannot precede created time',
        path: ['updatedAt'],
      });
    }
  });

export type LogbookEntry = z.infer<typeof logbookEntrySchema>;

export interface LogbookTotals {
  readonly blockMinutes: number;
  readonly dayMinutes: number;
  readonly dualMinutes: number;
  readonly flightMinutes: number;
  readonly instructorMinutes: number;
  readonly instrumentMinutes: number;
  readonly landingsDay: number;
  readonly landingsNight: number;
  readonly nightMinutes: number;
  readonly picMinutes: number;
  readonly sicMinutes: number;
}

export interface LogbookSummary {
  readonly entries: number;
  readonly jurisdictions: readonly string[];
  readonly regulatoryComplianceEvaluated: false;
  readonly totals: LogbookTotals;
}

type MutableLogbookTotals = { -readonly [Key in keyof LogbookTotals]: number };

const emptyTotals = (): MutableLogbookTotals => ({
  blockMinutes: 0,
  dayMinutes: 0,
  dualMinutes: 0,
  flightMinutes: 0,
  instructorMinutes: 0,
  instrumentMinutes: 0,
  landingsDay: 0,
  landingsNight: 0,
  nightMinutes: 0,
  picMinutes: 0,
  sicMinutes: 0,
});

const addSafely = (left: number, right: number): number => {
  const total = left + right;
  if (!Number.isSafeInteger(total)) throw new RangeError('Logbook summary exceeds safe limits');
  return total;
};

export const parseLogbookDuration = (value: string): number => {
  const match = /^(\d{1,3}):([0-5]\d)$/u.exec(value.trim());
  if (match === null) throw new Error('Duration must use H:MM');
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * 60 + minutes;
  if (!Number.isSafeInteger(total) || total > MAX_ENTRY_MINUTES) {
    throw new RangeError('Duration exceeds the per-entry limit');
  }
  return total;
};

export const parseLogbookCount = (value: string): number => {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d{0,2})$/u.test(normalized)) {
    throw new Error('Logbook count must be a whole number from 0 to 100');
  }
  const count = Number(normalized);
  if (count > 100) throw new Error('Logbook count must be a whole number from 0 to 100');
  return count;
};

export const formatLogbookDuration = (minutes: number): string => {
  if (!Number.isSafeInteger(minutes) || minutes < 0) {
    throw new RangeError('Duration must be non-negative whole minutes');
  }
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
};

export const summariseLogbook = (entries: readonly LogbookEntry[]): LogbookSummary => {
  const ids = new Set<string>();
  const jurisdictions = new Set<string>();
  const totals = emptyTotals();
  for (const source of entries) {
    const entry = logbookEntrySchema.parse(source);
    if (ids.has(entry.id)) throw new Error('Logbook entries must be unique');
    ids.add(entry.id);
    jurisdictions.add(entry.compliance.jurisdiction);
    for (const field of Object.keys(totals) as (keyof LogbookTotals)[]) {
      totals[field] = addSafely(totals[field], entry[field]);
    }
  }
  return {
    entries: entries.length,
    jurisdictions: [...jurisdictions].sort(),
    regulatoryComplianceEvaluated: false,
    totals,
  };
};
