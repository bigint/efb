import { z } from 'zod';

import {
  dataProvenanceSchema,
  feet,
  trueDegrees,
  type DataProvenance,
  type Feet,
  type TrueDegrees,
} from '@driftline/data-contracts';
import { greatCircleDistance, position, type Position } from '@driftline/geospatial';

const hasNoControlCharacters = (value: string): boolean =>
  [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code !== 127;
  });

const positionSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();

const runwaySchema = z
  .object({
    designator: z.string().regex(/^[A-Z0-9/-]{1,7}$/u),
    headingTrueDegrees: z.number().finite().min(0).lt(360).nullable(),
    lengthMetres: z.number().finite().positive().max(20_000),
    surface: z.string().trim().min(1).max(80).refine(hasNoControlCharacters),
    widthMetres: z.number().finite().positive().max(1_000),
  })
  .strict();

export const airportSourceSchema = z
  .object({
    elevationFeet: z.number().finite().min(-2_000).max(30_000),
    iata: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    icao: z.string().regex(/^[A-Z0-9]{3,4}$/),
    name: z.string().trim().min(1).max(160).refine(hasNoControlCharacters),
    position: positionSchema,
    provenance: dataProvenanceSchema,
    runways: z.array(runwaySchema).max(20),
    timezone: z.string().trim().min(1).max(100).refine(hasNoControlCharacters),
  })
  .strict()
  .superRefine((airport, context) => {
    if (airport.provenance.verificationStatus === 'invalid') {
      context.addIssue({
        code: 'custom',
        message: 'Invalid source data cannot enter the aviation domain',
        path: ['provenance', 'verificationStatus'],
      });
    }
    const designators = new Set<string>();
    airport.runways.forEach((runway, index) => {
      if (designators.has(runway.designator)) {
        context.addIssue({
          code: 'custom',
          message: 'Runway designators must be unique per airport',
          path: ['runways', index, 'designator'],
        });
      }
      designators.add(runway.designator);
    });
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: airport.timezone });
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Timezone must be a valid IANA time zone',
        path: ['timezone'],
      });
    }
  });

export interface Runway {
  readonly designator: string;
  readonly headingTrueDegrees: TrueDegrees | null;
  readonly lengthMetres: number;
  readonly surface: string;
  readonly widthMetres: number;
}

export interface Airport {
  readonly elevation: Feet;
  readonly iata: string | null;
  readonly icao: string;
  readonly name: string;
  readonly position: Position;
  readonly provenance: DataProvenance;
  readonly runways: readonly Runway[];
  readonly timezone: string;
}

export const parseAirport = (source: unknown): Airport => {
  const value = airportSourceSchema.parse(source);
  return {
    elevation: feet(value.elevationFeet),
    iata: value.iata,
    icao: value.icao,
    name: value.name,
    position: position(value.position.latitude, value.position.longitude),
    provenance: value.provenance,
    runways: value.runways.map((runway) => ({
      ...runway,
      headingTrueDegrees:
        runway.headingTrueDegrees === null ? null : trueDegrees(runway.headingTrueDegrees),
    })),
    timezone: value.timezone,
  };
};

export const searchAirports = (airports: readonly Airport[], query: string): Airport[] => {
  if (query.length > 80) return [];
  const needle = query.trim().toLocaleUpperCase('en-US');
  if (needle.length < 2) return [];
  return airports
    .filter((airport) =>
      [airport.icao, airport.iata ?? '', airport.name]
        .join(' ')
        .toLocaleUpperCase('en-US')
        .includes(needle),
    )
    .sort((left, right) => {
      const leftExact = left.icao === needle || left.iata === needle;
      const rightExact = right.icao === needle || right.iata === needle;
      return Number(rightExact) - Number(leftExact) || left.icao.localeCompare(right.icao);
    });
};

export interface NearbyAirport {
  readonly airport: Airport;
  readonly distanceNauticalMiles: number;
}

export const findNearbyAirports = (
  airports: readonly Airport[],
  origin: Airport,
  limit = 5,
): readonly NearbyAirport[] => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RangeError('Nearby airport limit must be between 1 and 50');
  }
  const identifiers = new Set<string>();
  for (const airport of airports) {
    if (identifiers.has(airport.icao))
      throw new Error('Nearby airport candidates must be unique');
    identifiers.add(airport.icao);
  }
  return airports
    .filter(({ icao }) => icao !== origin.icao)
    .map((airport) => ({
      airport,
      distanceNauticalMiles: greatCircleDistance(origin.position, airport.position),
    }))
    .sort(
      (left, right) =>
        left.distanceNauticalMiles - right.distanceNauticalMiles ||
        left.airport.icao.localeCompare(right.airport.icao),
    )
    .slice(0, limit);
};
