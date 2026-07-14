import { radii, spacing, typography } from '@driftline/design-system';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { demoAirports } from '@driftline/aviation-domain';
import { knots, trueDegrees } from '@driftline/data-contracts';
import {
  calculateRoute,
  calculateWindAdjustedRoute,
  resolveRouteIdentifiers,
} from '@driftline/flight-planning';

import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

export function PlanWorkspace() {
  const theme = useDriftlineTheme();
  const [trueAirspeed, setTrueAirspeed] = useState('118');
  const [windFromTrue, setWindFromTrue] = useState('0');
  const [windSpeed, setWindSpeed] = useState('0');
  const addWaypoint = useFlightStore((state) => state.addWaypoint);
  const clearRoute = useFlightStore((state) => state.clearRoute);
  const removeWaypoint = useFlightStore((state) => state.removeWaypoint);
  const reverseRoute = useFlightStore((state) => state.reverseRoute);
  const routeIdentifiers = useFlightStore((state) => state.routeIdentifiers);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);
  const routeResolution = resolveRouteIdentifiers(
    routeIdentifiers,
    demoAirports.map((airport) => ({ identifier: airport.icao, position: airport.position })),
  );
  const airports =
    routeResolution.status === 'resolved'
      ? routeResolution.waypoints.map((waypoint) => {
          const airport = demoAirports.find(({ icao }) => icao === waypoint.identifier);
          if (airport === undefined) throw new Error('Resolved airport invariant failed');
          return airport;
        })
      : [];
  const summary = calculateRoute(
    airports.map((airport) => ({ identifier: airport.icao, position: airport.position })),
    null,
  );
  const assumptionValues = [trueAirspeed, windFromTrue, windSpeed].map((value) =>
    value.trim().length === 0 ? Number.NaN : Number(value),
  );
  const assumptionsValid =
    assumptionValues.every(Number.isFinite) &&
    (assumptionValues[0] ?? 0) > 0 &&
    (assumptionValues[1] ?? -1) >= 0 &&
    (assumptionValues[1] ?? 360) < 360 &&
    (assumptionValues[2] ?? -1) >= 0;
  const windAdjusted = assumptionsValid
    ? calculateWindAdjustedRoute({
        trueAirspeed: knots(assumptionValues[0] ?? Number.NaN),
        waypoints: airports.map((airport) => ({
          identifier: airport.icao,
          position: airport.position,
        })),
        windFromTrue: trueDegrees(assumptionValues[1] ?? Number.NaN),
        windSpeed: knots(assumptionValues[2] ?? Number.NaN),
      })
    : null;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="DRAFT ROUTE · DEMONSTRATION" title="Plan" />
      <Card>
        <View style={styles.summary}>
          <Summary
            label="Distance"
            value={
              summary.status === 'ready'
                ? `${summary.totalDistance?.toFixed(1) ?? '—'} NM`
                : '—'
            }
          />
          <Summary
            label="ETE · demo wind"
            value={
              windAdjusted === null
                ? 'INVALID'
                : windAdjusted.status === 'ready'
                  ? `${windAdjusted.estimatedMinutes.toFixed(0)} MIN`
                  : windAdjusted.status === 'no-solution'
                    ? 'NO SOLUTION'
                    : '—'
            }
          />
          <Summary label="Legs" value={String(summary.legs.length)} />
          <Summary
            label="State"
            value={
              routeResolution.status === 'unresolved'
                ? 'BLOCKED'
                : windAdjusted === null
                  ? 'INVALID ASSUMPTIONS'
                  : windAdjusted.status === 'no-solution'
                    ? 'BLOCKED'
                    : summary.status.toUpperCase()
            }
          />
        </View>
      </Card>

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Planning assumptions
      </Text>
      <Card>
        <Text style={[styles.assumptionWarning, { color: theme.attention }]}>
          CONSTANT DEMONSTRATION WIND · TRUE REFERENCE
        </Text>
        <View style={styles.inputs}>
          <PlanningInput
            label="True airspeed · KT"
            onChange={setTrueAirspeed}
            value={trueAirspeed}
          />
          <PlanningInput
            label="Wind from · °T"
            onChange={setWindFromTrue}
            value={windFromTrue}
          />
          <PlanningInput label="Wind speed · KT" onChange={setWindSpeed} value={windSpeed} />
        </View>
        <Text style={[panelStyles.copy, styles.assumptionCopy, { color: theme.secondary }]}>
          One manually entered wind is applied to every leg. No winds-aloft source, altitude,
          valid time, interpolation, climb, or descent model is configured.
        </Text>
        {!assumptionsValid && (
          <Text accessibilityRole="alert" style={[styles.inputError, { color: theme.danger }]}>
            Enter TAS above 0 KT, wind direction from 0–359°T, and wind speed at or above 0 KT.
          </Text>
        )}
      </Card>

      {windAdjusted?.status === 'no-solution' && (
        <Card>
          <Text style={[styles.blocked, { color: theme.danger }]}>WIND SOLUTION BLOCKED</Text>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>
            {windAdjusted.failedLeg.from.identifier} → {windAdjusted.failedLeg.to.identifier}:{' '}
            {windAdjusted.reason.replaceAll('-', ' ')}.
          </Text>
        </Card>
      )}

      {windAdjusted?.status === 'ready' && (
        <View style={styles.legSolutions}>
          {windAdjusted.legs.map((leg) => (
            <Card key={`${leg.from.identifier}-${leg.to.identifier}`}>
              <Text style={[styles.legTitle, { color: theme.primary }]}>
                {leg.from.identifier} → {leg.to.identifier}
              </Text>
              <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                CRS {leg.initialTrueCourse.toFixed(0).padStart(3, '0')}°T · HDG{' '}
                {leg.wind.headingTrue.toFixed(0).padStart(3, '0')}°T · GS{' '}
                {leg.wind.groundspeed.toFixed(0)} KT · WCA {leg.wind.windCorrection.toFixed(1)}°
              </Text>
            </Card>
          ))}
        </View>
      )}

      {routeResolution.status === 'unresolved' && (
        <Card>
          <Text style={[styles.blocked, { color: theme.danger }]}>
            ROUTE CALCULATION BLOCKED
          </Text>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>
            The active dataset cannot resolve:{' '}
            {routeResolution.unresolvedIdentifiers.join(', ')}. Remove or replace every
            unresolved waypoint before using route results.
          </Text>
        </Card>
      )}

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Route sequence
      </Text>
      <View style={styles.routeList}>
        {routeIdentifiers.length === 0 && (
          <Card>
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              No route yet. Add a demonstration airport below.
            </Text>
          </Card>
        )}
        {routeIdentifiers.map((identifier, index) => {
          const airport = demoAirports.find(({ icao }) => icao === identifier);
          return (
            <Card key={`${identifier}-${index}`}>
              <View style={panelStyles.row}>
                <Text style={[styles.sequence, { color: theme.accent }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View style={styles.routeCopy}>
                  <Text style={[styles.identifier, { color: theme.primary }]}>
                    {identifier}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[panelStyles.copy, { color: theme.secondary }]}
                  >
                    {airport?.name ?? 'Unresolved in active demonstration dataset'}
                  </Text>
                </View>
                <Action label="Remove" onPress={() => removeWaypoint(identifier)} />
              </View>
            </Card>
          );
        })}
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

function PlanningInput({
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
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onChangeText={onChange}
        selectTextOnFocus
        style={[
          styles.input,
          {
            backgroundColor: theme.background,
            borderColor: theme.separator,
            color: theme.primary,
          },
        ]}
        value={value}
      />
    </View>
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
  assumptionCopy: { marginTop: spacing.md },
  assumptionWarning: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  blocked: { fontFamily: 'Menlo', fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  disclaimer: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
  identifier: { fontFamily: 'Menlo', fontSize: 16, fontWeight: '800' },
  input: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.mono,
    fontSize: 17,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inputGroup: { flex: 1, gap: spacing.xs, minWidth: 150 },
  inputError: {
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  legSolutions: { gap: spacing.sm, marginTop: spacing.md },
  legTitle: { fontFamily: typography.mono, fontSize: 14, fontWeight: '800' },
  routeCopy: { flex: 1 },
  routeList: { gap: spacing.sm },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  sequence: { fontFamily: 'Menlo', fontSize: 11, fontWeight: '800' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  summaryItem: { minWidth: 110 },
  summaryValue: { fontFamily: 'Menlo', fontSize: 20, fontWeight: '700', marginTop: 5 },
});
