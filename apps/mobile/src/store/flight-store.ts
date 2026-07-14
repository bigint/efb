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
import {
  defaultSimulationProfile,
  simulationProfileSchema,
  type SimulationProfile,
} from '@/domain/simulation-profile';

export type { Workspace } from '@/domain/persisted-flight';

interface FlightState {
  readonly activeLegIndex: number | null;
  readonly positionSample: PositionSample | null;
  readonly positionScenario: PositionScenario;
  readonly routeIdentifiers: string[];
  readonly selectedAirport: string | null;
  readonly simulationProfile: SimulationProfile;
  readonly workspace: Workspace;
  addWaypoint: (identifier: string) => void;
  clearRoute: () => void;
  ingestDeviceLocation: (location: DeviceLocationInput) => void;
  removeWaypoint: (identifier: string) => void;
  replaceRoute: (identifiers: readonly string[]) => void;
  reverseRoute: () => void;
  selectAirport: (identifier: string | null) => void;
  setActiveLegIndex: (index: number | null) => void;
  setDevicePositionEnabled: (enabled: boolean) => void;
  setDevicePositionStatus: (
    status: Extract<PositionScenario, { kind: 'device' }>['status'],
  ) => void;
  setGpsOutage: (outage: boolean) => void;
  setSimulationEnabled: (enabled: boolean) => void;
  setSimulationProfile: (profile: SimulationProfile) => void;
  setWorkspace: (workspace: Workspace) => void;
  tickSimulation: (sampledAt: number) => void;
}

const storage = createMMKV({ id: 'driftline-preferences' });
const PERSISTENCE_VERSION = 5;

const zustandStorage: StateStorage = {
  getItem: (name) =>
    sanitisePersistedJson(storage.getString(name) ?? null, PERSISTENCE_VERSION),
  removeItem: (name) => storage.remove(name),
  setItem: (name, value) => storage.set(name, value),
};

export const useFlightStore = create<FlightState>()(
  persist(
    (set) => ({
      activeLegIndex: null,
      addWaypoint: (identifier) =>
        set((state) =>
          state.routeIdentifiers.includes(identifier)
            ? state
            : {
                activeLegIndex: null,
                routeIdentifiers: [...state.routeIdentifiers, identifier],
              },
        ),
      clearRoute: () => set({ activeLegIndex: null, routeIdentifiers: [] }),
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
          activeLegIndex: null,
          routeIdentifiers: state.routeIdentifiers.filter((value) => value !== identifier),
        })),
      replaceRoute: (identifiers) =>
        set({ activeLegIndex: null, routeIdentifiers: [...identifiers] }),
      reverseRoute: () =>
        set((state) => ({
          activeLegIndex: null,
          routeIdentifiers: [...state.routeIdentifiers].reverse(),
        })),
      routeIdentifiers: demoAirports.slice(0, 2).map(({ icao }) => icao),
      selectAirport: (selectedAirport) => set({ selectedAirport }),
      selectedAirport: demoAirports[0]?.icao ?? null,
      setActiveLegIndex: (index) =>
        set((state) => {
          if (index === null) return { activeLegIndex: null };
          if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= state.routeIdentifiers.length - 1
          ) {
            throw new RangeError('Active leg index is outside the current route');
          }
          return { activeLegIndex: index };
        }),
      simulationProfile: defaultSimulationProfile,
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
      setSimulationProfile: (source) =>
        set((state) => {
          const profile = simulationProfileSchema.parse(source);
          if (!demoAirports.some(({ icao }) => icao === profile.startingAirportIdentifier)) {
            throw new Error('Simulation starting airport is unavailable');
          }
          return {
            positionSample: null,
            simulationProfile: profile,
            positionScenario:
              state.positionScenario.kind === 'simulated'
                ? { gpsAvailable: true, kind: 'simulated' }
                : state.positionScenario,
          };
        }),
      setWorkspace: (workspace) => set({ workspace }),
      tickSimulation: (sampledAt) =>
        set((state) => {
          if (
            !Number.isFinite(sampledAt) ||
            state.positionScenario.kind !== 'simulated' ||
            !state.positionScenario.gpsAvailable
          ) {
            return state.positionSample === null ? state : { positionSample: null };
          }
          const origin = demoAirports.find(
            ({ icao }) => icao === state.simulationProfile.startingAirportIdentifier,
          )?.position;
          if (origin === undefined) {
            return {
              positionSample: null,
              positionScenario: { gpsAvailable: false, kind: 'simulated' },
            };
          }
          try {
            return {
              positionSample: advanceSimulationSample({
                altitudeFeet: state.simulationProfile.altitudeFeet,
                groundspeedKnots: state.simulationProfile.groundspeedKnots,
                horizontalAccuracyMetres: state.simulationProfile.horizontalAccuracyMetres,
                origin,
                previous: state.positionSample,
                sampledAt,
                trackTrueDegrees: state.simulationProfile.trackTrueDegrees,
                verticalSpeedFeetPerMinute: state.simulationProfile.verticalSpeedFeetPerMinute,
              }),
            };
          } catch {
            return {
              positionSample: null,
              positionScenario: { gpsAvailable: false, kind: 'simulated' },
            };
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
        storedVersion <= 4 ? persistedState : safePersistedFlightState,
      name: 'flight-workspace-v2',
      partialize: ({ positionScenario, selectedAirport, simulationProfile, workspace }) => ({
        positionScenario:
          positionScenario.kind === 'device'
            ? { kind: 'device' as const, status: 'checking' as const }
            : positionScenario,
        selectedAirport,
        simulationProfile,
        workspace,
      }),
      storage: createJSONStorage(() => zustandStorage),
      version: PERSISTENCE_VERSION,
    },
  ),
);
