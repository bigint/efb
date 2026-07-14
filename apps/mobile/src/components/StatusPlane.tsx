import { cockpitTarget, radii, spacing, typography } from '@driftline/design-system';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';
import { evaluatePosition } from '@/domain/position-source';

export function StatusPlane() {
  const theme = useDriftlineTheme();
  const scenario = useFlightStore((state) => state.positionScenario);
  const sample = useFlightStore((state) => state.positionSample);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);
  const position = evaluatePosition(scenario, sample, Date.now());
  const available = position.kind === 'available';
  const title = available
    ? 'SIMULATION'
    : position.reason === 'gps-outage'
      ? 'GPS OUTAGE'
      : 'POSITION UNAVAILABLE';
  const detail = available
    ? `SIM fixture · ±${position.sample.horizontalAccuracyMetres} m · ${Math.floor(position.ageMilliseconds / 1000)} s old`
    : `${position.reason.replaceAll('-', ' ')} · no live values`;

  return (
    <Pressable
      accessibilityHint="Opens data and sensor status"
      accessibilityRole="button"
      onPress={() => setWorkspace('system')}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.panelRaised,
          borderColor: available ? theme.simulation : theme.danger,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.statusMark,
          { backgroundColor: available ? theme.simulation : theme.danger },
        ]}
      />
      <View style={styles.copy}>
        <Text style={[styles.primary, { color: theme.primary }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.secondary, { color: theme.secondary }]}>
          {detail}
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
