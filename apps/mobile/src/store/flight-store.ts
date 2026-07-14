import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { demoAirports } from '@driftline/aviation-domain';

import {
  restorePersistedFlightPreferences,
  safePersistedFlightState,
  sanitisePersistedJson,
  type Workspace,
} from '@/domain/persisted-flight';
import {
  advanceSimulationSample,
  mapDeviceLocation,
  type DeviceLocationInput,
  type PositionSample,
  type PositionScenario,
} from '@/domain/position-source';

export type { Workspace } from '@/domain/persisted-flight';

interface FlightState {
  readonly positionSample: PositionSample | null;
  readonly positionScenario: PositionScenario;
  readonly routeIdentifiers: string[];
  readonly selectedAirport: string | null;
  readonly workspace: Workspace;
  addWaypoint: (identifier: string) => void;
  clearRoute: () => void;
  ingestDeviceLocation: (location: DeviceLocationInput) => void;
  removeWaypoint: (identifier: string) => void;
  replaceRoute: (identifiers: readonly string[]) => void;
  reverseRoute: () => void;
  selectAirport: (identifier: string | null) => void;
  setDevicePositionEnabled: (enabled: boolean) => void;
  setDevicePositionStatus: (
    status: Extract<PositionScenario, { kind: 'device' }>['status'],
  ) => void;
  setGpsOutage: (outage: boolean) => void;
  setSimulationEnabled: (enabled: boolean) => void;
  setWorkspace: (workspace: Workspace) => void;
  tickSimulation: (sampledAt: number) => void;
}

const storage = createMMKV({ id: 'driftline-preferences' });
const PERSISTENCE_VERSION = 4;

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
      ingestDeviceLocation: (location) =>
        set((state) => {
          if (
            state.positionScenario.kind !== 'device' ||
            state.positionScenario.status !== 'watching'
          ) {
            return state;
          }
          try {
            return { positionSample: mapDeviceLocation(location) };
          } catch {
            return {
              positionSample: null,
              positionScenario: { kind: 'device', status: 'error' },
            };
          }
        }),
      positionSample: null,
      positionScenario: { gpsAvailable: true, kind: 'simulated' },
      removeWaypoint: (identifier) =>
        set((state) => ({
          routeIdentifiers: state.routeIdentifiers.filter((value) => value !== identifier),
        })),
      replaceRoute: (identifiers) => set({ routeIdentifiers: [...identifiers] }),
      reverseRoute: () =>
        set((state) => ({ routeIdentifiers: [...state.routeIdentifiers].reverse() })),
      routeIdentifiers: demoAirports.slice(0, 2).map(({ icao }) => icao),
      selectAirport: (selectedAirport) => set({ selectedAirport }),
      selectedAirport: demoAirports[0]?.icao ?? null,
      setDevicePositionEnabled: (enabled) =>
        set({
          positionSample: null,
          positionScenario: enabled
            ? { kind: 'device', status: 'checking' }
            : { kind: 'disabled' },
        }),
      setDevicePositionStatus: (status) =>
        set((state) =>
          state.positionScenario.kind === 'device'
            ? { positionSample: null, positionScenario: { kind: 'device', status } }
            : state,
        ),
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
          try {
            return {
              positionSample: advanceSimulationSample({
                altitudeFeet: 4_500,
                groundspeedKnots: 118,
                horizontalAccuracyMetres: 50,
                origin: initialPosition,
                previous: state.positionSample,
                sampledAt,
                trackTrueDegrees: 68,
              }),
            };
          } catch {
            return state.positionSample === null ? state : { positionSample: null };
          }
        }),
      workspace: 'map',
    }),
    {
      merge: (persisted, current) => {
        const parsed = restorePersistedFlightPreferences(persisted);
        return {
          ...current,
          ...parsed,
          positionSample: null,
        };
      },
      migrate: (persistedState, storedVersion) =>
        storedVersion <= 3 ? persistedState : safePersistedFlightState,
      name: 'flight-workspace-v2',
      partialize: ({ positionScenario, selectedAirport, workspace }) => ({
        positionScenario:
          positionScenario.kind === 'device'
            ? { kind: 'device' as const, status: 'checking' as const }
            : positionScenario,
        selectedAirport,
        workspace,
      }),
      storage: createJSONStorage(() => zustandStorage),
      version: PERSISTENCE_VERSION,
    },
  ),
);
