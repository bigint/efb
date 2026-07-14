import { createMMKV } from 'react-native-mmkv';
import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { demoAirports } from '@driftline/aviation-domain';

import type { PositionScenario, SimulationSample } from '@/domain/position-source';

export type Workspace = 'map' | 'plan' | 'places' | 'aircraft' | 'system';

interface FlightState {
  readonly positionSample: SimulationSample | null;
  readonly positionScenario: PositionScenario;
  readonly routeIdentifiers: string[];
  readonly selectedAirport: string | null;
  readonly workspace: Workspace;
  addWaypoint: (identifier: string) => void;
  clearRoute: () => void;
  removeWaypoint: (identifier: string) => void;
  reverseRoute: () => void;
  selectAirport: (identifier: string | null) => void;
  setGpsOutage: (outage: boolean) => void;
  setSimulationEnabled: (enabled: boolean) => void;
  setWorkspace: (workspace: Workspace) => void;
  tickSimulation: (sampledAt: number) => void;
}

const persistedFlightSchema = z
  .object({
    positionScenario: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('disabled') }).strict(),
      z.object({ gpsAvailable: z.boolean(), kind: z.literal('simulated') }).strict(),
    ]),
    routeIdentifiers: z.array(z.string().trim().min(1).max(16)).max(100),
    selectedAirport: z.string().trim().min(1).max(16).nullable(),
    workspace: z.enum(['map', 'plan', 'places', 'aircraft', 'system']),
  })
  .strict();

const storage = createMMKV({ id: 'driftline-preferences' });

const zustandStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  removeItem: (name) => storage.remove(name),
  setItem: (name, value) => storage.set(name, value),
};

const initialPosition = demoAirports[0]?.position;

export const useFlightStore = create<FlightState>()(
  persist(
    (set) => ({
      addWaypoint: (identifier) =>
        set((state) =>
          state.routeIdentifiers.includes(identifier)
            ? state
            : { routeIdentifiers: [...state.routeIdentifiers, identifier] },
        ),
      clearRoute: () => set({ routeIdentifiers: [] }),
      positionSample: null,
      positionScenario: { gpsAvailable: true, kind: 'simulated' },
      removeWaypoint: (identifier) =>
        set((state) => ({
          routeIdentifiers: state.routeIdentifiers.filter((value) => value !== identifier),
        })),
      reverseRoute: () =>
        set((state) => ({ routeIdentifiers: [...state.routeIdentifiers].reverse() })),
      routeIdentifiers: demoAirports.slice(0, 2).map(({ icao }) => icao),
      selectAirport: (selectedAirport) => set({ selectedAirport }),
      selectedAirport: demoAirports[0]?.icao ?? null,
      setGpsOutage: (outage) =>
        set((state) =>
          state.positionScenario.kind === 'simulated'
            ? {
                positionSample: outage ? null : state.positionSample,
                positionScenario: { gpsAvailable: !outage, kind: 'simulated' },
              }
            : state,
        ),
      setSimulationEnabled: (enabled) =>
        set({
          positionSample: null,
          positionScenario: enabled
            ? { gpsAvailable: true, kind: 'simulated' }
            : { kind: 'disabled' },
        }),
      setWorkspace: (workspace) => set({ workspace }),
      tickSimulation: (sampledAt) =>
        set((state) => {
          if (
            state.positionScenario.kind !== 'simulated' ||
            !state.positionScenario.gpsAvailable ||
            initialPosition === undefined
          ) {
            return state.positionSample === null ? state : { positionSample: null };
          }
          return {
            positionSample: {
              altitudeFeet: 4_500,
              groundspeedKnots: 118,
              horizontalAccuracyMetres: 50,
              latitude: initialPosition.latitude,
              longitude: initialPosition.longitude,
              sampledAt,
              trackTrueDegrees: null,
            },
          };
        }),
      workspace: 'map',
    }),
    {
      merge: (persisted, current) => {
        const parsed = persistedFlightSchema.safeParse(persisted);
        if (!parsed.success) {
          return { ...current, positionSample: null, positionScenario: { kind: 'disabled' } };
        }
        return { ...current, ...parsed.data, positionSample: null };
      },
      name: 'flight-workspace-v2',
      partialize: ({ positionScenario, routeIdentifiers, selectedAirport, workspace }) => ({
        positionScenario,
        routeIdentifiers,
        selectedAirport,
        workspace,
      }),
      storage: createJSONStorage(() => zustandStorage),
      version: 2,
    },
  ),
);
