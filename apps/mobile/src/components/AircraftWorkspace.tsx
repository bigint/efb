import { spacing } from '@driftline/design-system';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { calculateWeightBalance } from '@driftline/aircraft-performance';
import { kilograms, metres } from '@driftline/data-contracts';

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
  const [emptyMass, setEmptyMass] = useState('700');
  const [occupantMass, setOccupantMass] = useState('160');
  const [fuelMass, setFuelMass] = useState('100');
  const result = useMemo(() => {
    const inputs = [emptyMass, occupantMass, fuelMass];
    if (inputs.some((value) => value.trim().length === 0)) return null;
    const values = inputs.map(Number);
    if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
    try {
      return calculateWeightBalance({
        envelope: [
          { arm: metres(0.8), mass: kilograms(600) },
          { arm: metres(1.05), mass: kilograms(600) },
          { arm: metres(1.05), mass: kilograms(1_200) },
          { arm: metres(0.9), mass: kilograms(1_200) },
        ],
        maximumMass: kilograms(1_200),
        stations: [
          { arm: metres(0.9), id: 'empty-aircraft', mass: kilograms(values[0] ?? Number.NaN) },
          { arm: metres(1.2), id: 'occupants', mass: kilograms(values[1] ?? Number.NaN) },
          { arm: metres(1), id: 'fuel', mass: kilograms(values[2] ?? Number.NaN) },
        ],
      });
    } catch {
      return null;
    }
  }, [emptyMass, fuelMass, occupantMass]);
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
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Educational loading sandbox
      </Text>
      <Card>
        <Text style={[styles.warning, { color: theme.attention }]}>
          GENERIC GEOMETRY · NOT AN AIRCRAFT FLIGHT MANUAL
        </Text>
        <View style={styles.inputs}>
          <MassInput label="Empty aircraft" onChange={setEmptyMass} value={emptyMass} />
          <MassInput label="Occupants" onChange={setOccupantMass} value={occupantMass} />
          <MassInput label="Fuel" onChange={setFuelMass} value={fuelMass} />
        </View>
        <View style={styles.outputs}>
          <Output label="Total mass" value={result === null ? '—' : `${result.totalMass} KG`} />
          <Output
            label="CG arm"
            value={result === null ? '—' : `${result.centreOfGravityArm.toFixed(3)} M`}
          />
          <Output
            label="Demo envelope"
            value={
              result === null
                ? 'INVALID INPUT'
                : result.violations.length === 0
                  ? 'INSIDE'
                  : result.violations.join(' · ').toUpperCase()
            }
          />
        </View>
      </Card>
      <Text style={[panelStyles.copy, styles.note, { color: theme.secondary }]}>
        This sandbox proves typed mass, arm, moment, and polygon-envelope boundaries only.
        Aircraft-specific weight, balance, take-off, landing, climb, and fuel models remain
        blocked until their source, revision, interpolation rules, and legal distribution rights
        are explicit. Never transfer these values into a real loading decision.
      </Text>
    </ScrollView>
  );
}

function MassInput({
  label,
  onChange,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.inputGroup}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label} · KG</Text>
      <TextInput
        accessibilityLabel={`${label} mass in kilograms`}
        keyboardType="decimal-pad"
        onChangeText={onChange}
        selectTextOnFocus
        style={[
          styles.input,
          {
            backgroundColor: theme.panelRaised,
            borderColor: theme.separator,
            color: theme.primary,
          },
        ]}
        value={value}
      />
    </View>
  );
}

function Output({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.output}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text style={[styles.outputValue, { color: theme.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fact: { gap: spacing.xs, minWidth: 210 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, marginTop: spacing.xl },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: 'Menlo',
    fontSize: 18,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inputGroup: { flex: 1, gap: spacing.xs, minWidth: 150 },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  name: { fontFamily: 'Avenir Next Condensed', fontSize: 24, fontWeight: '700' },
  note: { marginTop: spacing.lg, maxWidth: 680 },
  output: { gap: spacing.xs, minWidth: 150 },
  outputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  outputValue: { fontFamily: 'Menlo', fontSize: 16, fontWeight: '800' },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  warning: {
    fontFamily: 'Menlo',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
});
