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
  mapDeviceLocation,
  type DeviceLocationInput,
  type PositionSample,
  type PositionScenario,
} from '@/domain/position-source';
import { reduceSimulationTick } from '@/domain/simulation-runtime';
import {
  defaultSimulationProfile,
  simulationProfileSchema,
  type SimulationProfile,
} from '@/domain/simulation-profile';
import { selectActiveLegIntent, selectDirectToIntent } from '@/domain/guidance-intent';
import { moveRouteWaypoint } from '@/domain/route-editing';

export type { Workspace } from '@/domain/persisted-flight';

interface FlightState {
  readonly activeLegIndex: number | null;
  readonly directToIdentifier: string | null;
  readonly positionSample: PositionSample | null;
  readonly positionScenario: PositionScenario;
  readonly routeIdentifiers: string[];
  readonly selectedAirport: string | null;
  readonly simulationProfile: SimulationProfile;
  readonly simulationPaused: boolean;
  readonly workspace: Workspace;
  addWaypoint: (identifier: string) => void;
  clearRoute: () => void;
  ingestDeviceLocation: (location: DeviceLocationInput) => void;
  moveWaypoint: (fromIndex: number, toIndex: number) => void;
  removeWaypoint: (identifier: string) => void;
  replaceRoute: (identifiers: readonly string[]) => void;
  reverseRoute: () => void;
  selectAirport: (identifier: string | null) => void;
  setActiveLegIndex: (index: number | null) => void;
  setDevicePositionEnabled: (enabled: boolean) => void;
  setDirectTo: (identifier: string | null) => void;
  setDevicePositionStatus: (
    status: Extract<PositionScenario, { kind: 'device' }>['status'],
  ) => void;
  setGpsOutage: (outage: boolean) => void;
  setSimulationEnabled: (enabled: boolean) => void;
  setSimulationPaused: (paused: boolean) => void;
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
                directToIdentifier: null,
                routeIdentifiers: [...state.routeIdentifiers, identifier],
              },
        ),
      clearRoute: () =>
        set({ activeLegIndex: null, directToIdentifier: null, routeIdentifiers: [] }),
      directToIdentifier: null,
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
      moveWaypoint: (fromIndex, toIndex) =>
        set((state) => ({
          activeLegIndex: null,
          directToIdentifier: null,
          routeIdentifiers: [...moveRouteWaypoint(state.routeIdentifiers, fromIndex, toIndex)],
        })),
      positionSample: null,
      positionScenario: { gpsAvailable: true, kind: 'simulated' },
      removeWaypoint: (identifier) =>
        set((state) => ({
          activeLegIndex: null,
          directToIdentifier: null,
          routeIdentifiers: state.routeIdentifiers.filter((value) => value !== identifier),
        })),
      replaceRoute: (identifiers) =>
        set({
          activeLegIndex: null,
          directToIdentifier: null,
          routeIdentifiers: [...identifiers],
        }),
      reverseRoute: () =>
        set((state) => ({
          activeLegIndex: null,
          directToIdentifier: null,
          routeIdentifiers: [...state.routeIdentifiers].reverse(),
        })),
      routeIdentifiers: demoAirports.slice(0, 2).map(({ icao }) => icao),
      selectAirport: (selectedAirport) => set({ selectedAirport }),
      selectedAirport: demoAirports[0]?.icao ?? null,
      setActiveLegIndex: (index) =>
        set((state) => selectActiveLegIntent(index, state.routeIdentifiers.length)),
      simulationProfile: defaultSimulationProfile,
      setDevicePositionEnabled: (enabled) =>
        set({
          positionSample: null,
          positionScenario: enabled
            ? { kind: 'device', status: 'checking' }
            : { kind: 'disabled' },
          simulationPaused: false,
        }),
      setDevicePositionStatus: (status) =>
        set((state) =>
          state.positionScenario.kind === 'device'
            ? { positionSample: null, positionScenario: { kind: 'device', status } }
            : state,
        ),
      setDirectTo: (identifier) =>
        set(() =>
          selectDirectToIntent(
            identifier,
            demoAirports.map(({ icao }) => icao),
          ),
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
          simulationPaused: false,
        }),
      setSimulationPaused: (paused) =>
        set((state) =>
          state.positionScenario.kind === 'simulated' ? { simulationPaused: paused } : state,
        ),
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
      simulationPaused: false,
      tickSimulation: (sampledAt) =>
        set((state) =>
          reduceSimulationTick({
            origins: demoAirports.map(({ icao, position }) => ({ identifier: icao, position })),
            paused: state.simulationPaused,
            positionSample: state.positionSample,
            positionScenario: state.positionScenario,
            profile: state.simulationProfile,
            sampledAt,
          }),
        ),
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
