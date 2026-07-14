import { z } from 'zod';

const boundedNumber = (maximum: number) => z.number().finite().min(0).max(maximum);
const hasNoControlCharacters = (value: string): boolean =>
  [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code !== 127;
  });

export const aircraftProfileUnitsSchema = z
  .object({
    arm: z.literal('m'),
    fuel: z.literal('l'),
    mass: z.literal('kg'),
    speed: z.literal('kt'),
  })
  .strict();

export const aircraftPlanningValuesSchema = z
  .object({
    cruiseSpeedKt: boundedNumber(1_000).positive(),
    emptyArmM: boundedNumber(20),
    emptyMassKg: boundedNumber(100_000).positive(),
    fuelArmM: boundedNumber(20),
    fuelBurnLitresPerHour: boundedNumber(10_000),
    maximumMassKg: boundedNumber(100_000).positive(),
    occupantArmM: boundedNumber(20),
    usableFuelLitres: boundedNumber(100_000),
  })
  .strict()
  .superRefine((values, context) => {
    if (values.maximumMassKg < values.emptyMassKg) {
      context.addIssue({
        code: 'custom',
        message: 'Maximum mass cannot be below empty mass',
        path: ['maximumMassKg'],
      });
    }
  });

export const aircraftProfileSchema = z
  .object({
    createdAt: z.iso.datetime(),
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(hasNoControlCharacters, 'Aircraft display name has control characters'),
    id: z.uuid(),
    notes: z.string().max(5_000),
    planning: aircraftPlanningValuesSchema,
    registration: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{1,16}$/u),
    revision: z.number().int().min(1),
    source: z.literal('user-entered'),
    typeDesignator: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9 /-]{1,24}$/u),
    units: aircraftProfileUnitsSchema,
    updatedAt: z.iso.datetime(),
    verificationStatus: z.literal('unverified'),
  })
  .strict()
  .superRefine((profile, context) => {
    if (Date.parse(profile.updatedAt) < Date.parse(profile.createdAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Updated time cannot precede created time',
        path: ['updatedAt'],
      });
    }
  });

export type AircraftProfile = z.infer<typeof aircraftProfileSchema>;

export interface AircraftProfileRevision {
  readonly displayName: AircraftProfile['displayName'];
  readonly notes: AircraftProfile['notes'];
  readonly planning: AircraftProfile['planning'];
  readonly registration: AircraftProfile['registration'];
  readonly typeDesignator: AircraftProfile['typeDesignator'];
}

export const reviseAircraftProfile = (
  source: AircraftProfile,
  changes: AircraftProfileRevision,
  updatedAt: string,
): AircraftProfile => {
  const profile = aircraftProfileSchema.parse(source);
  if (
    !Number.isFinite(Date.parse(updatedAt)) ||
    Date.parse(updatedAt) < Date.parse(profile.updatedAt)
  ) {
    throw new Error('Aircraft profile revision time cannot precede the current revision.');
  }
  return aircraftProfileSchema.parse({
    ...profile,
    ...changes,
    createdAt: profile.createdAt,
    id: profile.id,
    revision: profile.revision + 1,
    source: profile.source,
    units: profile.units,
    updatedAt,
    verificationStatus: profile.verificationStatus,
  });
};
