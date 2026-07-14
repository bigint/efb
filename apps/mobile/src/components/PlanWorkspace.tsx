import { spacing } from '@driftline/design-system';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { demoAirports } from '@driftline/aviation-domain';
import { knots } from '@driftline/data-contracts';
import { calculateRoute } from '@driftline/flight-planning';

import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

export function PlanWorkspace() {
  const theme = useDriftlineTheme();
  const addWaypoint = useFlightStore((state) => state.addWaypoint);
  const clearRoute = useFlightStore((state) => state.clearRoute);
  const removeWaypoint = useFlightStore((state) => state.removeWaypoint);
  const reverseRoute = useFlightStore((state) => state.reverseRoute);
  const routeIdentifiers = useFlightStore((state) => state.routeIdentifiers);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);
  const airports = routeIdentifiers
    .map((identifier) => demoAirports.find(({ icao }) => icao === identifier))
    .filter((airport) => airport !== undefined);
  const summary = calculateRoute(
    airports.map((airport) => ({ identifier: airport.icao, position: airport.position })),
    knots(118),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="DRAFT ROUTE · DEMONSTRATION" title="Plan" />
      <Card>
        <View style={styles.summary}>
          <Summary label="Distance" value={`${summary.totalDistance.toFixed(1)} NM`} />
          <Summary
            label="ETE at 118 KT"
            value={`${summary.estimatedMinutes?.toFixed(0) ?? '—'} MIN`}
          />
          <Summary label="Legs" value={String(summary.legs.length)} />
        </View>
      </Card>

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Route sequence
      </Text>
      <View style={styles.routeList}>
        {airports.length === 0 && (
          <Card>
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              No route yet. Add a demonstration airport below.
            </Text>
          </Card>
        )}
        {airports.map((airport, index) => (
          <Card key={airport.icao}>
            <View style={panelStyles.row}>
              <Text style={[styles.sequence, { color: theme.accent }]}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <View style={styles.routeCopy}>
                <Text style={[styles.identifier, { color: theme.primary }]}>
                  {airport.icao}
                </Text>
                <Text numberOfLines={1} style={[panelStyles.copy, { color: theme.secondary }]}>
                  {airport.name}
                </Text>
              </View>
              <Action label="Remove" onPress={() => removeWaypoint(airport.icao)} />
            </View>
          </Card>
        ))}
      </View>

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Add waypoint
      </Text>
      <View style={styles.actions}>
        {demoAirports
          .filter(({ icao }) => !routeIdentifiers.includes(icao))
          .map((airport) => (
            <Action
              key={airport.icao}
              label={`+ ${airport.icao}`}
              onPress={() => addWaypoint(airport.icao)}
            />
          ))}
      </View>
      <View style={styles.actions}>
        <Action label="Reverse route" onPress={reverseRoute} />
        <Action destructive label="Clear route" onPress={clearRoute} />
        <Action primary label="View on map" onPress={() => setWorkspace('map')} />
      </View>
      <Text style={[styles.disclaimer, { color: theme.attention }]}>
        Calculated on a spherical Earth model with fictional demonstration airports. Do not use
        for navigation.
      </Text>
    </ScrollView>
  );
}

function Summary({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.summaryItem}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: theme.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  disclaimer: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
  identifier: { fontFamily: 'Menlo', fontSize: 16, fontWeight: '800' },
  routeCopy: { flex: 1 },
  routeList: { gap: spacing.sm },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  sequence: { fontFamily: 'Menlo', fontSize: 11, fontWeight: '800' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  summaryItem: { minWidth: 110 },
  summaryValue: { fontFamily: 'Menlo', fontSize: 20, fontWeight: '700', marginTop: 5 },
});
