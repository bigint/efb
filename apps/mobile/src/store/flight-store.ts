import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { demoAirports } from '@driftline/aviation-domain';

export type Workspace = 'map' | 'plan' | 'places' | 'aircraft' | 'system';

interface FlightState {
  readonly gpsOutage: boolean;
  readonly routeIdentifiers: string[];
  readonly selectedAirport: string | null;
  readonly simulationEnabled: boolean;
  readonly workspace: Workspace;
  addWaypoint: (identifier: string) => void;
  clearRoute: () => void;
  removeWaypoint: (identifier: string) => void;
  reverseRoute: () => void;
  selectAirport: (identifier: string | null) => void;
  setGpsOutage: (outage: boolean) => void;
  setSimulationEnabled: (enabled: boolean) => void;
  setWorkspace: (workspace: Workspace) => void;
}

const storage = createMMKV({ id: 'driftline-preferences' });

const zustandStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  removeItem: (name) => storage.remove(name),
  setItem: (name, value) => storage.set(name, value),
};

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
      gpsOutage: false,
      removeWaypoint: (identifier) =>
        set((state) => ({
          routeIdentifiers: state.routeIdentifiers.filter((value) => value !== identifier),
        })),
      reverseRoute: () =>
        set((state) => ({ routeIdentifiers: [...state.routeIdentifiers].reverse() })),
      routeIdentifiers: demoAirports.slice(0, 2).map(({ icao }) => icao),
      selectAirport: (selectedAirport) => set({ selectedAirport }),
      selectedAirport: demoAirports[0]?.icao ?? null,
      setGpsOutage: (gpsOutage) => set({ gpsOutage }),
      setSimulationEnabled: (simulationEnabled) => set({ simulationEnabled }),
      setWorkspace: (workspace) => set({ workspace }),
      simulationEnabled: true,
      workspace: 'map',
    }),
    {
      name: 'flight-workspace-v1',
      partialize: ({ routeIdentifiers, selectedAirport, simulationEnabled, workspace }) => ({
        routeIdentifiers,
        selectedAirport,
        simulationEnabled,
        workspace,
      }),
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
    },
  ),
);
