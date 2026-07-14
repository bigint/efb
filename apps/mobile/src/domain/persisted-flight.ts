import { z } from 'zod';

import type { PositionScenario } from './position-source';
import {
  defaultSimulationProfile,
  simulationProfileSchema,
  type SimulationProfile,
} from './simulation-profile';

export const workspaceSchema = z.enum([
  'map',
  'plan',
  'places',
  'weather',
  'aircraft',
  'library',
  'records',
  'system',
]);
export type Workspace = z.infer<typeof workspaceSchema>;

export interface PersistedFlightState {
  readonly positionScenario: PositionScenario;
  readonly routeIdentifiers: string[];
  readonly selectedAirport: string | null;
  readonly simulationProfile: SimulationProfile;
  readonly workspace: Workspace;
}

export const safePersistedFlightState: PersistedFlightState = {
  positionScenario: { kind: 'disabled' },
  routeIdentifiers: [],
  selectedAirport: null,
  simulationProfile: defaultSimulationProfile,
  workspace: 'system',
};

const persistedAirportIdentifierSchema = z.string().regex(/^[A-Z0-9-]{1,16}$/u);

const persistedFlightSchema = z
  .object({
    positionScenario: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('disabled') }).strict(),
      z.object({ kind: z.literal('device'), status: z.literal('checking') }).strict(),
      z.object({ gpsAvailable: z.boolean(), kind: z.literal('simulated') }).strict(),
    ]),
    routeIdentifiers: z
      .array(persistedAirportIdentifierSchema)
      .max(100)
      .refine((identifiers) => new Set(identifiers).size === identifiers.length, {
        message: 'Persisted route identifiers must be unique',
      })
      .optional()
      .default([]),
    selectedAirport: persistedAirportIdentifierSchema.nullable(),
    simulationProfile: simulationProfileSchema.optional().default(defaultSimulationProfile),
    workspace: workspaceSchema,
  })
  .strict();

export const parsePersistedFlightState = (value: unknown): PersistedFlightState => {
  const parsed = persistedFlightSchema.safeParse(value);
  return parsed.success ? parsed.data : safePersistedFlightState;
};

export const restorePersistedFlightPreferences = (value: unknown): PersistedFlightState => ({
  ...parsePersistedFlightState(value),
  routeIdentifiers: [],
});

export const sanitisePersistedJson = (value: string | null, version: number): string | null => {
  if (value === null) return null;
  try {
    JSON.parse(value);
    return value;
  } catch {
    return JSON.stringify({ state: safePersistedFlightState, version });
  }
};
