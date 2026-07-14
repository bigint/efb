import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { cockpitTarget, radii, spacing, typography } from '@driftline/design-system';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { demoAirports } from '@driftline/aviation-domain';
import {
  calculateActiveLegNavigation,
  calculateDirectToNavigation,
  resolveRouteIdentifiers,
} from '@driftline/flight-planning';
import { position as geospatialPosition } from '@driftline/geospatial';

import { evaluatePosition } from '@/domain/position-source';
import { estimateArrivalUtc } from '@/domain/arrival-estimate';
import { resolveMapCamera, type MapOrientationMode } from '@/domain/map-camera';
import {
  appendMapMeasurementPoint,
  calculateMapMeasurement,
  type MapMeasurementPoints,
} from '@/domain/map-measurement';
import { useDevicePower } from '@/hooks/use-device-power';
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
  const devicePower = useDevicePower();
  const theme = useDriftlineTheme();
  const [measureEnabled, setMeasureEnabled] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<MapMeasurementPoints>([]);
  const [orientationMode, setOrientationMode] = useState<MapOrientationMode>('north-up');
  const activeLegIndex = useFlightStore((state) => state.activeLegIndex);
  const directToIdentifier = useFlightStore((state) => state.directToIdentifier);
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
  const setDirectTo = useFlightStore((state) => state.setDirectTo);

  const nowMilliseconds = Date.now();
  const position = evaluatePosition(positionScenario, positionSample, nowMilliseconds);
  const mapCamera = resolveMapCamera(orientationMode, position);
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
  const directToAirport =
    directToIdentifier === null
      ? null
      : (demoAirports.find(({ icao }) => icao === directToIdentifier) ?? null);
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
    directToIdentifier === null &&
    position.kind === 'available' &&
    routeResolution.status === 'resolved'
      ? calculateActiveLegNavigation({
          activeLegIndex,
          current: geospatialPosition(position.sample.latitude, position.sample.longitude),
          groundspeedKnots: position.sample.groundspeedKnots,
          waypoints: routeResolution.waypoints,
        })
      : null;
  const directToNavigation =
    position.kind === 'available' && directToAirport !== null
      ? calculateDirectToNavigation({
          current: geospatialPosition(position.sample.latitude, position.sample.longitude),
          groundspeedKnots: position.sample.groundspeedKnots,
          target: { identifier: directToAirport.icao, position: directToAirport.position },
        })
      : null;
  const destinationArrival = estimateArrivalUtc(
    nowMilliseconds,
    directToNavigation?.estimatedMinutes ??
      (activeNavigation?.status === 'ready'
        ? activeNavigation.estimatedMinutesRemaining
        : null),
  );
  const directToGeoJson = {
    features: [
      {
        geometry: {
          coordinates:
            position.kind === 'available' && directToAirport !== null
              ? [
                  [position.sample.longitude, position.sample.latitude],
                  [directToAirport.position.longitude, directToAirport.position.latitude],
                ]
              : [],
          type: 'LineString' as const,
        },
        properties: {},
        type: 'Feature' as const,
      },
    ],
    type: 'FeatureCollection' as const,
  };
  const measurement = calculateMapMeasurement(measurementPoints);
  const measurementGeoJson = {
    features: [
      {
        geometry: {
          coordinates: measurementPoints.map(({ latitude, longitude }) => [
            longitude,
            latitude,
          ]),
          type: 'LineString' as const,
        },
        properties: {},
        type: 'Feature' as const,
      },
    ],
    type: 'FeatureCollection' as const,
  };

  return (
    <View style={styles.container}>
      <Map
        attribution={false}
        compass
        logo={false}
        mapStyle={mapStyle}
        onLongPress={({ nativeEvent }) => {
          if (!measureEnabled) return;
          const [longitude, latitude] = nativeEvent.lngLat;
          setMeasurementPoints((current) =>
            appendMapMeasurementPoint(current, longitude, latitude),
          );
        }}
        preferredFramesPerSecond={60}
        scaleBar
        style={StyleSheet.absoluteFill}
      >
        <Camera
          bearing={mapCamera.bearing}
          duration={250}
          initialViewState={{ center: [77.6, 13.4], zoom: 5.7 }}
          {...(mapCamera.kind === 'track-up' ? { center: mapCamera.center } : {})}
        />
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
        {directToNavigation !== null && (
          <GeoJSONSource data={directToGeoJson} id="direct-to">
            <Layer
              id="direct-to-shadow"
              paint={{ 'line-color': theme.background, 'line-width': 10 }}
              type="line"
            />
            <Layer
              id="direct-to-line"
              paint={{
                'line-color': theme.attention,
                'line-dasharray': [2, 1],
                'line-width': 5,
              }}
              type="line"
            />
          </GeoJSONSource>
        )}
        {measurementPoints.length === 2 && (
          <GeoJSONSource data={measurementGeoJson} id="measurement">
            <Layer
              id="measurement-shadow"
              paint={{ 'line-color': theme.background, 'line-width': 7 }}
              type="line"
            />
            <Layer
              id="measurement-line"
              paint={{ 'line-color': theme.attention, 'line-width': 3 }}
              type="line"
            />
          </GeoJSONSource>
        )}
        {measurementPoints.map((point, index) => (
          <Marker
            anchor="center"
            id={`measurement-${index}`}
            key={`measurement-${index}`}
            lngLat={[point.longitude, point.latitude]}
          >
            <View
              accessibilityLabel={`Measurement point ${index === 0 ? 'A' : 'B'}`}
              style={[
                styles.measureMarker,
                { backgroundColor: theme.attention, borderColor: theme.background },
              ]}
            >
              <Text style={[styles.measureMarkerText, { color: theme.background }]}>
                {index === 0 ? 'A' : 'B'}
              </Text>
            </View>
          </Marker>
        ))}
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
        <View style={styles.mapTools}>
          <Pressable
            accessibilityLabel={
              orientationMode === 'north-up'
                ? 'Map orientation north up. Switch to track up.'
                : 'Map orientation track up requested. Switch to north up.'
            }
            accessibilityRole="button"
            onPress={() =>
              setOrientationMode((current) =>
                current === 'north-up' ? 'track-up' : 'north-up',
              )
            }
            style={({ pressed }) => [
              styles.orientationControl,
              { backgroundColor: theme.panelRaised, borderColor: theme.separator },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.orientationText,
                {
                  color:
                    mapCamera.kind === 'track-up-unavailable' ? theme.danger : theme.primary,
                },
              ]}
            >
              {mapCamera.kind === 'north-up'
                ? 'NORTH UP'
                : mapCamera.kind === 'track-up'
                  ? `TRACK UP · ${mapCamera.bearing.toFixed(0).padStart(3, '0')}° ${mapCamera.reference === 'true' ? 'T' : 'PLATFORM'}`
                  : 'TRACK UP UNAVAILABLE · NORTH FALLBACK'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={
              measureEnabled ? 'Disable and clear map measurement' : 'Enable map measurement'
            }
            accessibilityRole="button"
            onPress={() => {
              setMeasureEnabled((current) => !current);
              setMeasurementPoints([]);
            }}
            style={({ pressed }) => [
              styles.orientationControl,
              { backgroundColor: theme.panelRaised, borderColor: theme.separator },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.orientationText,
                { color: measureEnabled ? theme.attention : theme.primary },
              ]}
            >
              {measureEnabled ? 'MEASURE ON · CLEAR' : 'MEASURE'}
            </Text>
          </Pressable>
          {directToIdentifier !== null && (
            <Pressable
              accessibilityLabel={`Cancel direct to ${directToIdentifier}`}
              accessibilityRole="button"
              onPress={() => setDirectTo(null)}
              style={({ pressed }) => [
                styles.orientationControl,
                { backgroundColor: theme.panelRaised, borderColor: theme.attention },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.orientationText, { color: theme.attention }]}>
                CANCEL DIRECT TO {directToIdentifier}
              </Text>
            </Pressable>
          )}
        </View>
        {measureEnabled && (
          <View style={[styles.measureChip, { backgroundColor: theme.panelRaised }]}>
            <Text style={[styles.mapChipPrimary, { color: theme.attention }]}>
              {measurement.kind === 'ready'
                ? `${measurement.nauticalMiles.toFixed(1)} NM · ${measurement.initialTrueBearing === null ? 'BRG —' : `${measurement.initialTrueBearing.toFixed(0).padStart(3, '0')}°T`}`
                : measurement.points === 0
                  ? 'LONG-PRESS POINT A'
                  : 'LONG-PRESS POINT B'}
            </Text>
            <Text style={[styles.mapChipSecondary, { color: theme.secondary }]}>
              Great-circle display measure · third long-press starts again
            </Text>
          </View>
        )}
        <View style={[styles.mapChip, { backgroundColor: theme.panelRaised }]}>
          <Text style={[styles.mapChipPrimary, { color: theme.primary }]}>
            {directToIdentifier !== null
              ? `DIRECT TO · ${directToIdentifier}`
              : routeResolution.status === 'unresolved'
                ? 'ROUTE BLOCKED'
                : activeLegAirports.length === 2
                  ? `ACTIVE LEG · ${activeLegAirports.map(({ icao }) => icao).join(' → ')}`
                  : 'OFFLINE DEMO GRID'}
          </Text>
          <Text style={[styles.mapChipSecondary, { color: theme.secondary }]}>
            {directToIdentifier !== null
              ? directToNavigation === null
                ? 'Guidance unavailable · position required'
                : 'Explicit session guidance · route unchanged'
              : routeResolution.status === 'unresolved'
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
            value={
              directToNavigation?.targetIdentifier ??
              (activeNavigation?.status === 'ready' ? activeNavigation.nextIdentifier : '—')
            }
            unit={
              directToNavigation !== null
                ? `${directToNavigation.distance.toFixed(1)} NM · ${directToNavigation.estimatedMinutes === null ? 'ETE —' : `${directToNavigation.estimatedMinutes.toFixed(0)} MIN`}`
                : activeNavigation?.status === 'ready'
                  ? `${activeNavigation.distanceToNext.toFixed(1)} NM · ${activeNavigation.estimatedMinutesToNext === null ? 'ETE —' : `${activeNavigation.estimatedMinutesToNext.toFixed(0)} MIN`}`
                  : directToIdentifier !== null
                    ? 'POSITION REQUIRED'
                    : activeLegIndex === null
                      ? 'SELECT LEG'
                      : 'POSITION/ROUTE'
            }
          />
          <NavValue
            label="XTK"
            value={
              directToIdentifier !== null
                ? '—'
                : activeNavigation?.status === 'ready'
                  ? Math.abs(activeNavigation.crossTrack).toFixed(1)
                  : '—'
            }
            unit={
              directToIdentifier !== null
                ? 'N/A · DIRECT TO'
                : activeNavigation?.status === 'ready'
                  ? `NM ${activeNavigation.crossTrack < 0 ? 'LEFT' : activeNavigation.crossTrack > 0 ? 'RIGHT' : 'ON COURSE'}`
                  : 'NO ACTIVE LEG'
            }
          />
          <NavValue
            label="BRG"
            value={
              directToNavigation?.trueBearing !== null &&
              directToNavigation?.trueBearing !== undefined
                ? directToNavigation.trueBearing.toFixed(0).padStart(3, '0')
                : activeNavigation?.status === 'ready' &&
                    activeNavigation.trueBearingToNext !== null
                  ? activeNavigation.trueBearingToNext.toFixed(0).padStart(3, '0')
                  : '—'
            }
            unit="°T TO NEXT"
          />
          <NavValue
            label="REM"
            value={
              directToNavigation !== null
                ? directToNavigation.distance.toFixed(1)
                : activeNavigation?.status === 'ready'
                  ? activeNavigation.routeRemaining.toFixed(1)
                  : '—'
            }
            unit={
              directToNavigation !== null
                ? directToNavigation.estimatedMinutes === null
                  ? 'NM · ETE —'
                  : `NM · ${directToNavigation.estimatedMinutes.toFixed(0)} MIN`
                : activeNavigation?.status === 'ready'
                  ? activeNavigation.estimatedMinutesRemaining === null
                    ? 'NM · ETE —'
                    : `NM · ${activeNavigation.estimatedMinutesRemaining.toFixed(0)} MIN`
                  : directToIdentifier !== null
                    ? 'POSITION REQUIRED'
                    : 'NO ACTIVE LEG'
            }
          />
          <NavValue
            label="DATA"
            value={position.kind === 'available' ? position.origin.toUpperCase() : 'OFFLINE'}
            unit={
              position.kind === 'available'
                ? `${position.sample.horizontalAccuracyMetres === null ? 'ACC —' : `±${position.sample.horizontalAccuracyMetres.toFixed(0)} M`} · ${Math.floor(position.ageMilliseconds / 1_000)} S`
                : position.reason.replaceAll('-', ' ').toUpperCase()
            }
          />
          <NavValue
            label="ETA"
            value={
              destinationArrival.kind === 'ready'
                ? `${destinationArrival.isoUtc.slice(11, 16)}Z`
                : '—'
            }
            unit={
              destinationArrival.kind === 'ready'
                ? `${destinationArrival.isoUtc.slice(0, 10)} · DEST`
                : destinationArrival.reason.replaceAll('-', ' ').toUpperCase()
            }
          />
          <NavValue
            label="BAT"
            value={
              devicePower.kind === 'loading'
                ? '…'
                : devicePower.kind === 'available'
                  ? `${devicePower.levelPercent}%`
                  : '—'
            }
            unit={
              devicePower.kind === 'loading'
                ? 'CHECKING'
                : devicePower.kind === 'available'
                  ? `${devicePower.lowPowerMode ? 'LOW POWER · ' : ''}${devicePower.batteryState.replaceAll('-', ' ').toUpperCase()}`
                  : 'UNAVAILABLE'
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
  mapTools: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  measureChip: {
    alignSelf: 'flex-end',
    borderRadius: radii.control,
    marginBottom: spacing.sm,
    maxWidth: 360,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  measureMarker: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  measureMarkerText: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800' },
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
  orientationControl: {
    alignSelf: 'flex-end',
    borderRadius: radii.control,
    borderWidth: 1,
    minHeight: cockpitTarget,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  orientationText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
