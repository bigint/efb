import 'react-native-gesture-handler';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { initialiseLocalDatabases, USER_DATABASE_NAME } from '@/database/user-database';
import { LocalDatabaseBoundary } from '@/components/LocalDatabaseBoundary';
import { useFlightStore } from '@/store/flight-store';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { networkMode: 'offlineFirst', retry: 1, staleTime: 30_000 },
        },
      }),
  );

  useEffect(() => {
    const tick = () => useFlightStore.getState().tickSimulation(Date.now());
    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (interval !== null) clearInterval(interval);
      interval = null;
    };
    const start = () => {
      stop();
      tick();
      interval = setInterval(tick, 1_000);
    };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, []);

  return (
    <LocalDatabaseBoundary>
      <SQLiteProvider databaseName={USER_DATABASE_NAME} onInit={initialiseLocalDatabases}>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SQLiteProvider>
    </LocalDatabaseBoundary>
  );
}
