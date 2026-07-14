import { spacing } from '@driftline/design-system';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

import { Card, PanelHeader, panelStyles } from './PanelPrimitives';

export function SystemWorkspace() {
  const theme = useDriftlineTheme();
  const gpsOutage = useFlightStore((state) => state.gpsOutage);
  const setGpsOutage = useFlightStore((state) => state.setGpsOutage);
  const setSimulationEnabled = useFlightStore((state) => state.setSimulationEnabled);
  const simulation = useFlightStore((state) => state.simulationEnabled);

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="EVIDENCE & RECOVERY" title="System" />
      <Card>
        <Setting
          detail="Persistent visual framing identifies every simulated position."
          label="Simulation source"
          onValueChange={setSimulationEnabled}
          value={simulation}
        />
        <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        <Setting
          detail="Inject a complete position-source failure and block derived GPS values."
          label="GPS outage injection"
          onValueChange={setGpsOutage}
          value={gpsOutage}
        />
      </Card>
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Data status
      </Text>
      <Card>
        <Status label="Airport dataset" value="demo-2026-07-14 · unverified" />
        <Status label="Map base" value="offline graticule · no chart data" />
        <Status label="Weather" value="unavailable · no provider configured" />
        <Status
          label="Position"
          value={gpsOutage ? 'unavailable · injected failure' : 'simulated · fixture origin'}
        />
      </Card>
      <Text style={[styles.safety, { color: theme.danger }]}>
        NOT APPROVED AS A PRIMARY NAVIGATION INSTRUMENT
      </Text>
      <Text style={[panelStyles.copy, { color: theme.secondary }]}>
        This development slice is for simulation, education, and architecture validation. It
        contains fictional airports and no licensed chart, NOTAM, obstacle, terrain, or current
        weather data.
      </Text>
    </ScrollView>
  );
}

function Setting({
  detail,
  label,
  onValueChange,
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly onValueChange: (value: boolean) => void;
  readonly value: boolean;
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.setting}>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingLabel, { color: theme.primary }]}>{label}</Text>
        <Text style={[panelStyles.copy, { color: theme.secondary }]}>{detail}</Text>
      </View>
      <Switch accessibilityLabel={label} onValueChange={onValueChange} value={value} />
    </View>
  );
}

function Status({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.status}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text style={[panelStyles.value, { color: theme.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safety: {
    fontFamily: 'Menlo',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: spacing.lg },
  setting: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  settingCopy: { flex: 1 },
  settingLabel: { fontFamily: 'Avenir Next', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  status: { gap: spacing.xs, marginBottom: spacing.lg },
});
