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
import {
  calculateActiveLegNavigation,
  resolveRouteIdentifiers,
} from '@driftline/flight-planning';
import { position as geospatialPosition } from '@driftline/geospatial';

import { evaluatePosition } from '@/domain/position-source';
import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

import { OwnshipGlyph } from './OwnshipGlyph';

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
  const activeLegIndex = useFlightStore((state) => state.activeLegIndex);
  const mapStyle = useMemo<StyleSpecification>(
    () => ({
      layers: [
        {
          id: 'background',
          paint: { 'background-color': theme.mapLand },
          type: 'background',
        },
      ],
      sources: {},
      version: 8,
    }),
    [theme.mapLand],
  );
  const positionSample = useFlightStore((state) => state.positionSample);
  const positionScenario = useFlightStore((state) => state.positionScenario);
  const routeIdentifiers = useFlightStore((state) => state.routeIdentifiers);
  const selectAirport = useFlightStore((state) => state.selectAirport);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);

  const position = evaluatePosition(positionScenario, positionSample, Date.now());
  const routeResolution = resolveRouteIdentifiers(
    routeIdentifiers,
    demoAirports.map((airport) => ({ identifier: airport.icao, position: airport.position })),
  );
  const routeAirports =
    routeResolution.status === 'resolved'
      ? routeResolution.waypoints.map((waypoint) => {
          const airport = demoAirports.find(({ icao }) => icao === waypoint.identifier);
          if (airport === undefined) throw new Error('Resolved airport invariant failed');
          return airport;
        })
      : [];
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
  const activeLegAirports =
    activeLegIndex !== null && activeLegIndex >= 0 && activeLegIndex + 1 < routeAirports.length
      ? routeAirports.slice(activeLegIndex, activeLegIndex + 2)
      : [];
  const activeLegGeoJson = {
    features: [
      {
        geometry: {
          coordinates: activeLegAirports.map(({ position: value }) => [
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
  const ownship = position.kind === 'available' ? position.sample : null;
  const ownshipOrigin = position.kind === 'available' ? position.origin : null;
  const positionUnit =
    position.kind === 'available'
      ? position.origin === 'device'
        ? 'DEVICE'
        : 'SIM'
      : 'NO SOURCE';
  const activeNavigation =
    position.kind === 'available' && routeResolution.status === 'resolved'
      ? calculateActiveLegNavigation({
          activeLegIndex,
          current: geospatialPosition(position.sample.latitude, position.sample.longitude),
          groundspeedKnots: position.sample.groundspeedKnots,
          waypoints: routeResolution.waypoints,
        })
      : null;

  return (
    <View style={styles.container}>
      <Map
        attribution={false}
        compass
        logo={false}
        mapStyle={mapStyle}
        preferredFramesPerSecond={60}
        scaleBar
        style={StyleSheet.absoluteFill}
      >
        <Camera initialViewState={{ center: [77.6, 13.4], zoom: 5.7 }} />
        <GeoJSONSource data={graticule} id="graticule">
          <Layer
            id="grid-lines"
            paint={{ 'line-color': theme.separator, 'line-opacity': 0.58, 'line-width': 1 }}
            type="line"
          />
        </GeoJSONSource>
        {routeAirports.length >= 2 && (
          <GeoJSONSource data={routeGeoJson} id="route">
            <Layer
              id="route-shadow"
              paint={{ 'line-color': theme.background, 'line-width': 8 }}
              type="line"
            />
            <Layer
              id="route-line"
              paint={{ 'line-color': theme.secondary, 'line-width': 3 }}
              type="line"
            />
          </GeoJSONSource>
        )}
        {activeLegAirports.length === 2 && (
          <GeoJSONSource data={activeLegGeoJson} id="active-leg">
            <Layer
              id="active-leg-shadow"
              paint={{ 'line-color': theme.background, 'line-width': 10 }}
              type="line"
            />
            <Layer
              id="active-leg-line"
              paint={{ 'line-color': theme.accent, 'line-width': 6 }}
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
              accessibilityLabel={`${airport.icao}, fictional demonstration airport`}
              accessibilityRole="button"
              accessible
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
        {ownship !== null && ownshipOrigin !== null && (
          <Marker anchor="center" id="ownship" lngLat={[ownship.longitude, ownship.latitude]}>
            <OwnshipGlyph
              accuracyMetres={ownship.horizontalAccuracyMetres}
              origin={ownshipOrigin}
              trackDegrees={ownship.trackDegrees}
              trackReference={ownship.trackReference}
            />
          </Marker>
        )}
      </Map>

      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={[styles.mapChip, { backgroundColor: theme.panelRaised }]}>
          <Text style={[styles.mapChipPrimary, { color: theme.primary }]}>
            {routeResolution.status === 'unresolved'
              ? 'ROUTE BLOCKED'
              : activeLegAirports.length === 2
                ? `ACTIVE LEG · ${activeLegAirports.map(({ icao }) => icao).join(' → ')}`
                : 'OFFLINE DEMO GRID'}
          </Text>
          <Text style={[styles.mapChipSecondary, { color: theme.secondary }]}>
            {routeResolution.status === 'unresolved'
              ? `Unresolved: ${routeResolution.unresolvedIdentifiers.join(', ')}`
              : activeLegAirports.length === 2
                ? 'Explicit selection · no automatic sequencing'
                : 'No chart data loaded'}
          </Text>
        </View>
        <View style={styles.navStrip}>
          <NavValue
            label="GS"
            value={
              position.kind === 'available' && position.sample.groundspeedKnots !== null
                ? position.sample.groundspeedKnots.toFixed(0)
                : '—'
            }
            unit={`KT ${positionUnit}`}
          />
          <NavValue
            label="ALT"
            value={
              position.kind === 'available' && position.sample.altitudeFeet !== null
                ? position.sample.altitudeFeet.toLocaleString('en-US')
                : '—'
            }
            unit={`FT ${positionUnit}`}
          />
          <NavValue
            label="TRK"
            value={
              position.kind === 'available' && position.sample.trackDegrees !== null
                ? position.sample.trackDegrees.toFixed(0).padStart(3, '0')
                : '—'
            }
            unit={
              position.kind === 'available' && position.sample.trackDegrees !== null
                ? position.sample.trackReference === 'true'
                  ? '°T'
                  : '° PLATFORM'
                : 'NO COURSE'
            }
          />
          <NavValue
            label="NEXT"
            value={activeNavigation?.status === 'ready' ? activeNavigation.nextIdentifier : '—'}
            unit={
              activeNavigation?.status === 'ready'
                ? `${activeNavigation.distanceToNext.toFixed(1)} NM`
                : activeLegIndex === null
                  ? 'SELECT LEG'
                  : 'POSITION/ROUTE'
            }
          />
          <NavValue
            label="XTK"
            value={
              activeNavigation?.status === 'ready'
                ? Math.abs(activeNavigation.crossTrack).toFixed(1)
                : '—'
            }
            unit={
              activeNavigation?.status === 'ready'
                ? `NM ${activeNavigation.crossTrack < 0 ? 'LEFT' : activeNavigation.crossTrack > 0 ? 'RIGHT' : 'ON COURSE'}`
                : 'NO ACTIVE LEG'
            }
          />
          <NavValue
            label="REM"
            value={
              activeNavigation?.status === 'ready'
                ? activeNavigation.routeRemaining.toFixed(1)
                : '—'
            }
            unit={
              activeNavigation?.status === 'ready'
                ? activeNavigation.estimatedMinutesRemaining === null
                  ? 'NM · ETE —'
                  : `NM · ${activeNavigation.estimatedMinutesRemaining.toFixed(0)} MIN`
                : 'NO ACTIVE LEG'
            }
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
          <Text style={[styles.nearestText, { color: theme.onAccent }]}>⌖ PLACES</Text>
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
  airportMarker: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: cockpitTarget,
    minWidth: cockpitTarget,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  airportMarkerText: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800' },
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
  navLabel: {
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  navNumber: { fontFamily: typography.mono, fontSize: 21, fontWeight: '700', marginTop: 2 },
  navStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 'auto' },
  navUnit: { fontFamily: typography.body, fontSize: 10, fontWeight: '700' },
  navValue: {
    borderRadius: radii.control,
    borderWidth: 1,
    flexBasis: 92,
    flexGrow: 1,
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
