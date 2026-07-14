import { spacing } from '@driftline/design-system';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDriftlineTheme } from '@/theme';

import { Card, PanelHeader, panelStyles } from './PanelPrimitives';

const facts = [
  ['Profile', 'DL-GA-01'],
  ['Type', 'Generic educational single-engine'],
  ['Cruise planning speed', '118 KT'],
  ['Performance authority', 'None · demonstration only'],
] as const;

export function AircraftWorkspace() {
  const theme = useDriftlineTheme();
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="GENERIC PROFILE" title="Aircraft" />
      <Card>
        <Text style={[styles.name, { color: theme.primary }]}>Driftline GA Trainer</Text>
        <Text style={[styles.warning, { color: theme.attention }]}>
          FICTIONAL · NO CERTIFIED PERFORMANCE DATA
        </Text>
        <View style={styles.facts}>
          {facts.map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
              <Text style={[panelStyles.value, { color: theme.primary }]}>{value}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Text style={[panelStyles.copy, styles.note, { color: theme.secondary }]}>
        Aircraft-specific weight, balance, take-off, landing, climb, and fuel models remain
        blocked until their source, revision, interpolation rules, and legal distribution rights
        are explicit.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fact: { gap: spacing.xs, minWidth: 210 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, marginTop: spacing.xl },
  name: { fontFamily: 'Avenir Next Condensed', fontSize: 24, fontWeight: '700' },
  note: { marginTop: spacing.lg, maxWidth: 680 },
  scroll: { paddingBottom: spacing.xxl },
  warning: {
    fontFamily: 'Menlo',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
});
