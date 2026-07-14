import { cockpitTarget, radii, spacing, typography } from '@driftline/design-system';
import { demoAirports } from '@driftline/aviation-domain';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

/**
 * Browser-safe map workspace.
 *
 * MapLibre React Native is a native-code component and cannot be evaluated by
 * react-native-web. The browser preview keeps the planning and navigation
 * workflows available while making the missing native chart renderer explicit.
 */
export function MapWorkspace() {
  const theme = useDriftlineTheme();
  const [layersOpen, setLayersOpen] = useState(false);
  const [northUp, setNorthUp] = useState(true);
  const activeLegIndex = useFlightStore((state) => state.activeLegIndex);
  const directToIdentifier = useFlightStore((state) => state.directToIdentifier);
  const positionSample = useFlightStore((state) => state.positionSample);
  const routeIdentifiers = useFlightStore((state) => state.routeIdentifiers);
  const selectAirport = useFlightStore((state) => state.selectAirport);
  const setDirectTo = useFlightStore((state) => state.setDirectTo);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);

  const routeLabel = routeIdentifiers.length > 0 ? routeIdentifiers.join(' → ') : 'NO ROUTE';
  const nextIdentifier =
    directToIdentifier ??
    (activeLegIndex === null ? null : (routeIdentifiers[activeLegIndex + 1] ?? null));
  const airportByIdentifier = useMemo(
    () => new Map(demoAirports.map((airport) => [airport.icao, airport])),
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.mapLand }]}>
      <View
        accessibilityLabel="Browser map preview"
        style={[styles.mapCanvas, { borderColor: theme.separator }]}
      >
        <View pointerEvents="none" style={styles.grid}>
          {Array.from({ length: 8 }, (_, index) => (
            <View
              key={`horizontal-${index}`}
              style={[
                styles.horizontalGridLine,
                { backgroundColor: theme.separator, top: `${(index + 1) * 11}%` },
              ]}
            />
          ))}
          {Array.from({ length: 10 }, (_, index) => (
            <View
              key={`vertical-${index}`}
              style={[
                styles.verticalGridLine,
                { backgroundColor: theme.separator, left: `${(index + 1) * 9}%` },
              ]}
            />
          ))}
        </View>

        <View style={styles.airports}>
          {demoAirports.map((airport) => {
            const routeIndex = routeIdentifiers.indexOf(airport.icao);
            const isDirectTo = airport.icao === directToIdentifier;
            return (
              <Pressable
                accessibilityLabel={`${airport.icao}, fictional demonstration airport. Open place details.`}
                accessibilityRole="button"
                key={airport.icao}
                onPress={() => {
                  selectAirport(airport.icao);
                  setWorkspace('places');
                }}
                style={({ pressed }) => [
                  styles.airport,
                  {
                    backgroundColor: theme.panelRaised,
                    borderColor: isDirectTo ? theme.attention : theme.accent,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.airportIdentifier, { color: theme.primary }]}>
                  {airport.icao}
                </Text>
                <Text style={[styles.airportMeta, { color: theme.secondary }]}>
                  {isDirectTo ? 'DIRECT TO' : routeIndex >= 0 ? `ROUTE ${routeIndex + 1}` : 'DEMO'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tools}>
          <ToolButton
            label={northUp ? 'NORTH UP' : 'TRACK UP PREVIEW'}
            onPress={() => setNorthUp((current) => !current)}
          />
          <ToolButton
            label={layersOpen ? 'CLOSE LAYERS' : 'LAYERS · LEGEND'}
            onPress={() => setLayersOpen((current) => !current)}
          />
          {directToIdentifier !== null && (
            <ToolButton
              attention
              label={`CANCEL DIRECT TO ${directToIdentifier}`}
              onPress={() => setDirectTo(null)}
            />
          )}
        </View>

        <View style={[styles.notice, { backgroundColor: theme.panelRaised }]}> 
          <Text style={[styles.noticeTitle, { color: theme.attention }]}>WEB PREVIEW</Text>
          <Text style={[styles.noticeCopy, { color: theme.secondary }]}> 
            Interactive native map rendering is available in the iOS and Android development builds.
          </Text>
        </View>
      </View>

      {layersOpen && (
        <View style={[styles.layerPanel, { backgroundColor: theme.panelRaised }]}> 
          <Text style={[styles.label, { color: theme.primary }]}>DISPLAY LAYERS · WEB PREVIEW</Text>
          <Text style={[styles.copy, { color: theme.secondary }]}> 
            Demo airports and the stored route remain interactive. Chart, terrain, airspace,
            obstacle, weather overlay, range rings, measurement, and ownship rendering require
            the native MapLibre runtime.
          </Text>
        </View>
      )}

      <View style={[styles.routeStrip, { backgroundColor: theme.panelRaised }]}> 
        <View style={styles.routeCopy}>
          <Text style={[styles.label, { color: theme.primary }]}>STORED ROUTE</Text>
          <Text numberOfLines={1} style={[styles.route, { color: theme.accent }]}>
            {routeLabel}
          </Text>
        </View>
        <View style={styles.navValue}>
          <Text style={[styles.label, { color: theme.secondary }]}>NEXT</Text>
          <Text style={[styles.value, { color: theme.primary }]}>{nextIdentifier ?? '—'}</Text>
        </View>
        <View style={styles.navValue}>
          <Text style={[styles.label, { color: theme.secondary }]}>GS</Text>
          <Text style={[styles.value, { color: theme.primary }]}> 
            {positionSample?.groundspeedKnots?.toFixed(0) ?? '—'}
          </Text>
          <Text style={[styles.unit, { color: theme.secondary }]}>KT</Text>
        </View>
        <View style={styles.navValue}>
          <Text style={[styles.label, { color: theme.secondary }]}>ALT</Text>
          <Text style={[styles.value, { color: theme.primary }]}> 
            {positionSample?.altitudeFeet?.toLocaleString('en-US') ?? '—'}
          </Text>
          <Text style={[styles.unit, { color: theme.secondary }]}>FT</Text>
        </View>
      </View>
    </View>
  );
}

function ToolButton({
  attention = false,
  label,
  onPress,
}: {
  readonly attention?: boolean;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const theme = useDriftlineTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolButton,
        { backgroundColor: theme.panelRaised, borderColor: attention ? theme.attention : theme.separator },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.toolText, { color: attention ? theme.attention : theme.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  airport: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 2,
    minHeight: cockpitTarget,
    minWidth: 88,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  airportIdentifier: { fontFamily: typography.display, fontSize: 14, fontWeight: '900' },
  airportMeta: { fontFamily: typography.body, fontSize: 9, fontWeight: '800', marginTop: 2 },
  airports: {
    alignContent: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  container: { flex: 1, minHeight: 0 },
  copy: { fontFamily: typography.body, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.48 },
  horizontalGridLine: { height: StyleSheet.hairlineWidth, left: 0, position: 'absolute', right: 0 },
  label: { fontFamily: typography.body, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  layerPanel: { borderRadius: radii.md, left: spacing.md, padding: spacing.md, position: 'absolute', right: spacing.md, top: 78 },
  mapCanvas: { borderBottomWidth: StyleSheet.hairlineWidth, flex: 1, minHeight: 280, overflow: 'hidden' },
  navValue: { alignItems: 'flex-end', minWidth: 70 },
  notice: { bottom: spacing.md, left: spacing.md, maxWidth: 420, padding: spacing.sm, position: 'absolute' },
  noticeCopy: { fontFamily: typography.body, fontSize: 11, lineHeight: 16, marginTop: 2 },
  noticeTitle: { fontFamily: typography.display, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pressed: { opacity: 0.68 },
  route: { fontFamily: typography.display, fontSize: 16, fontWeight: '900', marginTop: 3 },
  routeCopy: { flex: 1, minWidth: 160 },
  routeStrip: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toolButton: { borderRadius: radii.sm, borderWidth: StyleSheet.hairlineWidth, minHeight: cockpitTarget, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  toolText: { fontFamily: typography.body, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, left: spacing.md, position: 'absolute', right: spacing.md, top: spacing.md },
  unit: { fontFamily: typography.body, fontSize: 9, fontWeight: '700' },
  value: { fontFamily: typography.display, fontSize: 16, fontWeight: '900', marginTop: 2 },
  verticalGridLine: { bottom: 0, position: 'absolute', top: 0, width: StyleSheet.hairlineWidth },
});
