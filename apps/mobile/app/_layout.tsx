import 'react-native-gesture-handler';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useState } from 'react';

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
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
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
