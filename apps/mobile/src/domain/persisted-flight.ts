import { z } from 'zod';

import type { PositionScenario } from './position-source';

export const workspaceSchema = z.enum([
  'map',
  'plan',
  'places',
  'weather',
  'aircraft',
  'records',
  'system',
]);
export type Workspace = z.infer<typeof workspaceSchema>;

export interface PersistedFlightState {
  readonly positionScenario: PositionScenario;
  readonly routeIdentifiers: string[];
  readonly selectedAirport: string | null;
  readonly workspace: Workspace;
}

export const safePersistedFlightState: PersistedFlightState = {
  positionScenario: { kind: 'disabled' },
  routeIdentifiers: [],
  selectedAirport: null,
  workspace: 'system',
};

const persistedFlightSchema = z
  .object({
    positionScenario: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('disabled') }).strict(),
      z.object({ gpsAvailable: z.boolean(), kind: z.literal('simulated') }).strict(),
    ]),
    routeIdentifiers: z
      .array(z.string().trim().min(1).max(16))
      .max(100)
      .refine((identifiers) => new Set(identifiers).size === identifiers.length, {
        message: 'Persisted route identifiers must be unique',
      }),
    selectedAirport: z.string().trim().min(1).max(16).nullable(),
    workspace: workspaceSchema,
  })
  .strict();

export const parsePersistedFlightState = (value: unknown): PersistedFlightState => {
  const parsed = persistedFlightSchema.safeParse(value);
  return parsed.success ? parsed.data : safePersistedFlightState;
};

export const sanitisePersistedJson = (value: string | null, version: number): string | null => {
  if (value === null) return null;
  try {
    JSON.parse(value);
    return value;
  } catch {
    return JSON.stringify({ state: safePersistedFlightState, version });
  }
};
