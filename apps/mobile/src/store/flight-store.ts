import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { demoAirports } from '@driftline/aviation-domain';

import {
  parsePersistedFlightState,
  sanitisePersistedJson,
  type Workspace,
} from '@/domain/persisted-flight';
import type { PositionScenario, SimulationSample } from '@/domain/position-source';

export type { Workspace } from '@/domain/persisted-flight';

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

const storage = createMMKV({ id: 'driftline-preferences' });
const PERSISTENCE_VERSION = 2;

const zustandStorage: StateStorage = {
  getItem: (name) =>
    sanitisePersistedJson(storage.getString(name) ?? null, PERSISTENCE_VERSION),
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
            !Number.isFinite(sampledAt) ||
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
        const parsed = parsePersistedFlightState(persisted);
        return {
          ...current,
          ...parsed,
          positionSample: null,
        };
      },
      name: 'flight-workspace-v2',
      partialize: ({ positionScenario, routeIdentifiers, selectedAirport, workspace }) => ({
        positionScenario,
        routeIdentifiers,
        selectedAirport,
        workspace,
      }),
      storage: createJSONStorage(() => zustandStorage),
      version: PERSISTENCE_VERSION,
    },
  ),
);
