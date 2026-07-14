import { spacing } from '@driftline/design-system';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AircraftWorkspace } from '@/components/AircraftWorkspace';
import { LibraryWorkspace } from '@/components/LibraryWorkspace';
import { MapWorkspace } from '@/components/MapWorkspace';
import { PlacesWorkspace } from '@/components/PlacesWorkspace';
import { PlanWorkspace } from '@/components/PlanWorkspace';
import { RecordsWorkspace } from '@/components/RecordsWorkspace';
import { StatusPlane } from '@/components/StatusPlane';
import { SystemWorkspace } from '@/components/SystemWorkspace';
import { WeatherWorkspace } from '@/components/WeatherWorkspace';
import { WorkspaceRail } from '@/components/WorkspaceRail';
import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

export default function HomeScreen() {
  const theme = useDriftlineTheme();
  const colourScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const scenario = useFlightStore((state) => state.positionScenario);
  const workspace = useFlightStore((state) => state.workspace);

  const content = (() => {
    switch (workspace) {
      case 'aircraft':
        return <AircraftWorkspace />;
      case 'library':
        return <LibraryWorkspace />;
      case 'map':
        return <MapWorkspace />;
      case 'places':
        return <PlacesWorkspace />;
      case 'plan':
        return <PlanWorkspace />;
      case 'records':
        return <RecordsWorkspace />;
      case 'system':
        return <SystemWorkspace />;
      case 'weather':
        return <WeatherWorkspace />;
    }
  })();

  return (
    <SafeAreaView
      edges={['top', 'right', 'bottom', 'left']}
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
          borderColor: scenario.kind === 'simulated' ? theme.simulation : theme.background,
        },
      ]}
    >
      <StatusBar style={colourScheme === 'light' ? 'dark' : 'light'} />
      <View style={styles.header}>
        <StatusPlane />
      </View>
      <View style={[styles.shell, compact && styles.shellCompact]}>
        {!compact && <WorkspaceRail compact={false} />}
        <View style={styles.content}>{content}</View>
        {compact && <WorkspaceRail compact />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  header: { paddingBottom: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  safeArea: { borderWidth: 3, flex: 1 },
  shell: { flex: 1, flexDirection: 'row' },
  shellCompact: { flexDirection: 'column' },
});
