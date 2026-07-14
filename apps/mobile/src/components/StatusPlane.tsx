import { cockpitTarget, radii, spacing, typography } from '@driftline/design-system';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

export function StatusPlane() {
  const theme = useDriftlineTheme();
  const simulation = useFlightStore((state) => state.simulationEnabled);
  const gpsOutage = useFlightStore((state) => state.gpsOutage);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);

  return (
    <Pressable
      accessibilityHint="Opens data and sensor status"
      accessibilityRole="button"
      onPress={() => setWorkspace('system')}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.panelRaised,
          borderColor: simulation ? theme.simulation : theme.separator,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.statusMark,
          { backgroundColor: gpsOutage ? theme.danger : theme.simulation },
        ]}
      />
      <View style={styles.copy}>
        <Text style={[styles.primary, { color: theme.primary }]}>
          {gpsOutage ? 'GPS OUTAGE' : simulation ? 'SIMULATION' : 'POSITION STANDBY'}
        </Text>
        <Text numberOfLines={1} style={[styles.secondary, { color: theme.secondary }]}>
          Demo data · offline · version demo-2026-07-14
        </Text>
      </View>
      <Text style={[styles.disclosure, { color: theme.secondary }]}>STATUS ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: radii.capsule,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: cockpitTarget,
    paddingHorizontal: spacing.lg,
  },
  copy: { flex: 1, marginHorizontal: spacing.md },
  disclosure: {
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  primary: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  secondary: { fontFamily: typography.body, fontSize: 11, marginTop: 1 },
  statusMark: { borderRadius: 2, height: 16, transform: [{ rotate: '45deg' }], width: 16 },
});
