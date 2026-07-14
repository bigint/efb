import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { cockpitTarget, radii, spacing, typography } from '@driftline/design-system';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { demoAirports } from '@driftline/aviation-domain';
import { knots } from '@driftline/data-contracts';
import { calculateRoute } from '@driftline/flight-planning';

import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

import { OwnshipGlyph } from './OwnshipGlyph';

const offlineStyle: StyleSpecification = {
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#17221F' } }],
  sources: {},
  version: 8,
};

const graticule = {
  features: Array.from({ length: 25 }, (_, index) => {
    const offset = index - 12;
    const isLatitude = index % 2 === 0;
    return {
      geometry: {
        coordinates: isLatitude
          ? [
              [65, 6 + offset / 2],
              [88, 6 + offset / 2],
            ]
          : [
              [65 + offset, 5],
              [65 + offset, 25],
            ],
        type: 'LineString' as const,
      },
      properties: {},
      type: 'Feature' as const,
    };
  }),
  type: 'FeatureCollection' as const,
};

export function MapWorkspace() {
  const theme = useDriftlineTheme();
  const gpsOutage = useFlightStore((state) => state.gpsOutage);
  const routeIdentifiers = useFlightStore((state) => state.routeIdentifiers);
  const selectAirport = useFlightStore((state) => state.selectAirport);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);

  const routeAirports = routeIdentifiers
    .map((identifier) => demoAirports.find(({ icao }) => icao === identifier))
    .filter((airport) => airport !== undefined);
  const summary = useMemo(
    () =>
      calculateRoute(
        routeAirports.map((airport) => ({
          identifier: airport.icao,
          position: airport.position,
        })),
        knots(118),
      ),
    [routeAirports],
  );
  const routeGeoJson = {
    features: [
      {
        geometry: {
          coordinates: routeAirports.map(({ position: value }) => [
            value.longitude,
            value.latitude,
          ]),
          type: 'LineString' as const,
        },
        properties: {},
        type: 'Feature' as const,
      },
    ],
    type: 'FeatureCollection' as const,
  };
  const ownship = routeAirports[0]?.position ?? demoAirports[0]?.position;

  return (
    <View style={styles.container}>
      <Map
        attribution={false}
        compass
        logo={false}
        mapStyle={offlineStyle}
        preferredFramesPerSecond={60}
        scaleBar
        style={StyleSheet.absoluteFill}
      >
        <Camera initialViewState={{ center: [77.6, 13.4], zoom: 5.7 }} />
        <GeoJSONSource data={graticule} id="graticule">
          <Layer
            id="grid-lines"
            paint={{ 'line-color': '#42534F', 'line-opacity': 0.42, 'line-width': 1 }}
            type="line"
          />
        </GeoJSONSource>
        {routeAirports.length >= 2 && (
          <GeoJSONSource data={routeGeoJson} id="active-route">
            <Layer
              id="route-shadow"
              paint={{ 'line-color': '#07100F', 'line-width': 8 }}
              type="line"
            />
            <Layer
              id="route-line"
              paint={{ 'line-color': '#45C0C6', 'line-width': 4 }}
              type="line"
            />
          </GeoJSONSource>
        )}
        {demoAirports.map((airport) => (
          <Marker
            anchor="center"
            id={airport.icao}
            key={airport.icao}
            lngLat={[airport.position.longitude, airport.position.latitude]}
            onPress={() => {
              selectAirport(airport.icao);
              setWorkspace('places');
            }}
          >
            <View
              style={[
                styles.airportMarker,
                { backgroundColor: theme.panelRaised, borderColor: theme.accent },
              ]}
            >
              <Text style={[styles.airportMarkerText, { color: theme.primary }]}>
                {airport.icao}
              </Text>
            </View>
          </Marker>
        ))}
        {ownship !== undefined && (
          <Marker anchor="center" id="ownship" lngLat={[ownship.longitude, ownship.latitude]}>
            <OwnshipGlyph degraded={gpsOutage} />
          </Marker>
        )}
      </Map>

      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={[styles.mapChip, { backgroundColor: theme.panelRaised }]}>
          <Text style={[styles.mapChipPrimary, { color: theme.primary }]}>
            OFFLINE DEMO GRID
          </Text>
          <Text style={[styles.mapChipSecondary, { color: theme.secondary }]}>
            No chart data loaded
          </Text>
        </View>
        <View style={styles.navStrip}>
          <NavValue label="GS" value={gpsOutage ? '—' : '118'} unit="KT" />
          <NavValue label="ALT" value={gpsOutage ? '—' : '4,500'} unit="FT GPS" />
          <NavValue label="DIST" value={summary.totalDistance.toFixed(1)} unit="NM" />
          <NavValue
            label="ETE"
            value={summary.estimatedMinutes?.toFixed(0) ?? '—'}
            unit="MIN"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setWorkspace('places')}
          style={({ pressed }) => [
            styles.nearest,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.nearestText}>⌖ NEAREST</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavValue({
  label,
  unit,
  value,
}: {
  readonly label: string;
  readonly unit: string;
  readonly value: string;
}) {
  const theme = useDriftlineTheme();
  return (
    <View
      style={[
        styles.navValue,
        { backgroundColor: theme.panelRaised, borderColor: theme.separator },
      ]}
    >
      <Text style={[styles.navLabel, { color: theme.secondary }]}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[styles.navNumber, { color: theme.primary }]}
      >
        {value}
      </Text>
      <Text style={[styles.navUnit, { color: theme.secondary }]}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  airportMarker: { borderRadius: 7, borderWidth: 2, paddingHorizontal: 6, paddingVertical: 4 },
  airportMarkerText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800' },
  container: { flex: 1, overflow: 'hidden' },
  mapChip: {
    alignSelf: 'flex-start',
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mapChipPrimary: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mapChipSecondary: { fontFamily: typography.body, fontSize: 10, marginTop: 2 },
  navLabel: { fontFamily: typography.body, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  navNumber: { fontFamily: typography.mono, fontSize: 19, fontWeight: '700', marginTop: 2 },
  navStrip: { flexDirection: 'row', gap: spacing.xs, marginTop: 'auto' },
  navUnit: { fontFamily: typography.body, fontSize: 8, fontWeight: '700' },
  navValue: {
    borderRadius: radii.control,
    borderWidth: 1,
    flex: 1,
    minHeight: 70,
    padding: spacing.sm,
  },
  nearest: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: radii.control,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: cockpitTarget,
    paddingHorizontal: spacing.lg,
  },
  nearestText: {
    color: '#FFFFFF',
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  overlay: {
    bottom: 0,
    left: 0,
    padding: spacing.md,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
