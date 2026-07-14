import { z } from 'zod';

import {
  dataProvenanceSchema,
  feet,
  type DataProvenance,
  type Feet,
} from '@driftline/data-contracts';
import { position, type Position } from '@driftline/geospatial';

const positionSchema = z
  .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
  .strict();

const runwaySchema = z
  .object({
    designator: z.string().min(1).max(7),
    headingTrueDegrees: z.number().min(0).lt(360).nullable(),
    lengthMetres: z.number().positive(),
    surface: z.string().min(1),
    widthMetres: z.number().positive(),
  })
  .strict();

export const airportSourceSchema = z
  .object({
    elevationFeet: z.number(),
    iata: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    icao: z.string().regex(/^[A-Z0-9]{3,4}$/),
    name: z.string().min(1),
    position: positionSchema,
    provenance: dataProvenanceSchema,
    runways: z.array(runwaySchema),
    timezone: z.string().min(1),
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
  readonly headingTrueDegrees: number | null;
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
    runways: value.runways,
    timezone: value.timezone,
  };
};

export const searchAirports = (airports: readonly Airport[], query: string): Airport[] => {
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
