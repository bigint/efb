import { radii, spacing, typography } from '@driftline/design-system';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { demoAirports, searchAirports } from '@driftline/aviation-domain';

import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

export function PlacesWorkspace() {
  const theme = useDriftlineTheme();
  const [query, setQuery] = useState('');
  const addWaypoint = useFlightStore((state) => state.addWaypoint);
  const selectedIdentifier = useFlightStore((state) => state.selectedAirport);
  const selectAirport = useFlightStore((state) => state.selectAirport);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);
  const results = useMemo(
    () => (query.trim().length < 2 ? [...demoAirports] : searchAirports(demoAirports, query)),
    [query],
  );
  const selected = demoAirports.find(({ icao }) => icao === selectedIdentifier) ?? results[0];

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="LOCAL FIXTURE · OFFLINE" title="Places" />
      <TextInput
        accessibilityLabel="Search demonstration airports"
        autoCapitalize="characters"
        onChangeText={setQuery}
        placeholder="Identifier or airport name"
        placeholderTextColor={theme.secondary}
        style={[
          styles.search,
          {
            backgroundColor: theme.panelRaised,
            borderColor: theme.separator,
            color: theme.primary,
          },
        ]}
        value={query}
      />
      <View style={styles.layout}>
        <View style={styles.results}>
          {results.map((airport) => (
            <Pressable
              accessibilityRole="button"
              key={airport.icao}
              onPress={() => selectAirport(airport.icao)}
              style={({ pressed }) => [
                styles.result,
                {
                  backgroundColor:
                    selected?.icao === airport.icao ? theme.accent : theme.panelRaised,
                  borderColor: selected?.icao === airport.icao ? theme.accent : theme.separator,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.resultId,
                  { color: selected?.icao === airport.icao ? '#FFFFFF' : theme.primary },
                ]}
              >
                {airport.icao}
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  styles.resultName,
                  { color: selected?.icao === airport.icao ? '#E8FFFF' : theme.secondary },
                ]}
              >
                {airport.name}
              </Text>
            </Pressable>
          ))}
        </View>
        {selected !== undefined && (
          <View style={styles.detail}>
            <Card>
              <Text style={[styles.detailIdentifier, { color: theme.primary }]}>
                {selected.icao}
              </Text>
              <Text style={[styles.detailName, { color: theme.primary }]}>{selected.name}</Text>
              <Text style={[styles.warning, { color: theme.attention }]}>
                FICTIONAL DEMONSTRATION AIRPORT
              </Text>
              <View style={styles.facts}>
                <Fact label="Elevation" value={`${selected.elevation} FT`} />
                <Fact label="Timezone" value={selected.timezone} />
                <Fact
                  label="Position"
                  value={`${selected.position.latitude.toFixed(4)}, ${selected.position.longitude.toFixed(4)}`}
                />
                <Fact label="Source" value={selected.provenance.source} />
              </View>
            </Card>
            <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
              Runways
            </Text>
            {selected.runways.map((runway) => (
              <Card key={runway.designator}>
                <View style={panelStyles.row}>
                  <Text style={[styles.runway, { color: theme.primary }]}>
                    {runway.designator}
                  </Text>
                  <View style={styles.routeCopy}>
                    <Text style={[panelStyles.value, { color: theme.primary }]}>
                      {runway.lengthMetres} × {runway.widthMetres} M
                    </Text>
                    <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                      {runway.surface}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
            <View style={styles.actions}>
              <Action label="Add to route" onPress={() => addWaypoint(selected.icao)} />
              <Action primary label="Show map" onPress={() => setWorkspace('map')} />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.fact}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text selectable style={[panelStyles.value, styles.factValue, { color: theme.primary }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  detail: { flex: 2, minWidth: 280 },
  detailIdentifier: { fontFamily: typography.mono, fontSize: 30, fontWeight: '800' },
  detailName: {
    fontFamily: typography.display,
    fontSize: 19,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  fact: { gap: 4, minWidth: 130 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.lg },
  factValue: { fontSize: 12, maxWidth: 240 },
  layout: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.lg },
  pressed: { opacity: 0.7 },
  result: { borderRadius: radii.control, borderWidth: 1, minHeight: 70, padding: spacing.md },
  resultId: { fontFamily: typography.mono, fontSize: 15, fontWeight: '800' },
  resultName: { fontFamily: typography.body, fontSize: 11, lineHeight: 15, marginTop: 3 },
  results: { flex: 1, gap: spacing.sm, minWidth: 210 },
  routeCopy: { flex: 1 },
  runway: { fontFamily: typography.mono, fontSize: 18, fontWeight: '800', minWidth: 70 },
  scroll: { paddingBottom: spacing.xxl },
  search: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.body,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  section: { marginTop: spacing.xl },
  warning: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
});
