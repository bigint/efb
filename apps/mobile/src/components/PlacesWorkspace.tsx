import { radii, spacing, typography } from '@driftline/design-system';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  calculateSolarEvents,
  demoAirports,
  findNearbyAirports,
  searchAirports,
} from '@driftline/aviation-domain';
import { classifyDataCurrency, trueDegrees, type TrueDegrees } from '@driftline/data-contracts';
import { calculateRunwayWindComponents } from '@driftline/flight-planning';

import { evaluatePosition } from '@/domain/position-source';
import { calculateRelativePosition } from '@/domain/relative-position';
import { calendarDateInTimeZone } from '@/domain/calendar-date';
import { parseRunwayWindInput, type RunwayWindInput } from '@/domain/runway-wind-input';
import {
  listAirportFavourites,
  setAirportFavourite,
} from '@/database/airport-favourite-repository';
import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

export function PlacesWorkspace() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [favouriteError, setFavouriteError] = useState<string | null>(null);
  const [favouriteIdentifiers, setFavouriteIdentifiers] = useState<readonly string[]>([]);
  const [savingFavourite, setSavingFavourite] = useState(false);
  const [query, setQuery] = useState('');
  const [windDirection, setWindDirection] = useState('');
  const [windGust, setWindGust] = useState('');
  const [windSpeed, setWindSpeed] = useState('');
  const addWaypoint = useFlightStore((state) => state.addWaypoint);
  const positionSample = useFlightStore((state) => state.positionSample);
  const positionScenario = useFlightStore((state) => state.positionScenario);
  const selectedIdentifier = useFlightStore((state) => state.selectedAirport);
  const selectAirport = useFlightStore((state) => state.selectAirport);
  const setDirectTo = useFlightStore((state) => state.setDirectTo);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);
  const results = useMemo(
    () => (query.trim().length < 2 ? [...demoAirports] : searchAirports(demoAirports, query)),
    [query],
  );
  const selected = demoAirports.find(({ icao }) => icao === selectedIdentifier) ?? results[0];
  const currency =
    selected === undefined ? null : classifyDataCurrency(selected.provenance, new Date());
  const evaluatedPosition = evaluatePosition(positionScenario, positionSample, Date.now());
  const relative =
    selected === undefined
      ? null
      : calculateRelativePosition(evaluatedPosition, selected.position);
  const nearby = selected === undefined ? [] : findNearbyAirports(demoAirports, selected, 5);
  const solarCalendarDate =
    selected === undefined ? null : calendarDateInTimeZone(new Date(), selected.timezone);
  const solarEvents =
    selected === undefined || solarCalendarDate === null
      ? null
      : calculateSolarEvents(selected.position, solarCalendarDate);
  const runwayWind = useMemo(
    () => parseRunwayWindInput(windDirection, windSpeed, windGust),
    [windDirection, windGust, windSpeed],
  );

  const reloadFavourites = useCallback(async () => {
    try {
      setFavouriteIdentifiers(await listAirportFavourites(database));
      setFavouriteError(null);
    } catch {
      setFavouriteIdentifiers([]);
      setFavouriteError('Favourites unavailable; airport browsing remains available.');
    }
  }, [database]);

  useEffect(() => {
    void reloadFavourites();
  }, [reloadFavourites]);

  const toggleFavourite = async () => {
    if (selected === undefined) return;
    setSavingFavourite(true);
    try {
      await setAirportFavourite(
        database,
        selected.icao,
        !favouriteIdentifiers.includes(selected.icao),
        new Date().toISOString(),
      );
      await reloadFavourites();
    } catch (caught) {
      setFavouriteError(
        caught instanceof Error ? caught.message : 'Unable to change airport favourite.',
      );
    } finally {
      setSavingFavourite(false);
    }
  };

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
              accessibilityLabel={`${airport.icao}, ${airport.name}${favouriteIdentifiers.includes(airport.icao) ? ', favourite' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: selected?.icao === airport.icao }}
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
                  { color: selected?.icao === airport.icao ? theme.onAccent : theme.primary },
                ]}
              >
                {favouriteIdentifiers.includes(airport.icao) ? '★ ' : ''}
                {airport.icao}
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  styles.resultName,
                  { color: selected?.icao === airport.icao ? theme.onAccent : theme.secondary },
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
                <Fact label="Dataset" value={selected.provenance.datasetVersion} />
                <Fact label="Retrieved" value={selected.provenance.retrievedAt} />
                <Fact
                  label="Effective"
                  value={selected.provenance.effectiveAt ?? 'NOT SUPPLIED'}
                />
                <Fact label="Expires" value={selected.provenance.expiresAt ?? 'NOT SUPPLIED'} />
                <Fact label="Verification" value={selected.provenance.verificationStatus} />
                <Fact label="Confidence" value={selected.provenance.confidence} />
                <Fact label="Currency" value={currency ?? 'unknown'} />
              </View>
              <View style={[styles.relative, { borderColor: theme.separator }]}>
                <Text style={[styles.warning, { color: theme.attention }]}>
                  RELATIVE POSITION · ADVISORY · TRUE REFERENCE
                </Text>
                {relative === null ? (
                  <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                    Unavailable: position source is{' '}
                    {evaluatedPosition.kind === 'unavailable'
                      ? evaluatedPosition.reason.replaceAll('-', ' ')
                      : 'not usable'}
                    .
                  </Text>
                ) : (
                  <View style={styles.facts}>
                    <Fact
                      label="Distance"
                      value={`${relative.distanceNauticalMiles.toFixed(1)} NM`}
                    />
                    <Fact
                      label="Initial bearing"
                      value={
                        relative.bearingTrue === null
                          ? '—'
                          : `${relative.bearingTrue.toFixed(0).padStart(3, '0')}°T`
                      }
                    />
                    <Fact label="Source" value={relative.origin.toUpperCase()} />
                    <Fact
                      label="Position age"
                      value={`${(relative.ageMilliseconds / 1_000).toFixed(1)} S`}
                    />
                    <Fact
                      label="Horizontal accuracy"
                      value={
                        relative.accuracyMetres === null
                          ? 'UNAVAILABLE'
                          : `${relative.accuracyMetres.toFixed(0)} M`
                      }
                    />
                  </View>
                )}
              </View>
            </Card>
            <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
              Runways
            </Text>
            <Card>
              <Text style={[styles.warning, { color: theme.attention }]}>
                USER-ENTERED WIND · TRUE REFERENCE · TRANSIENT
              </Text>
              <Text
                style={[panelStyles.copy, styles.unavailableCopy, { color: theme.secondary }]}
              >
                Enter meteorological wind-from direction in 0–359°T and speed in knots. Gust is
                optional and must not be below steady speed. No METAR, magnetic conversion,
                aircraft limit, runway selection, or operational recommendation is inferred.
              </Text>
              <View style={styles.windInputs}>
                <WindInput
                  label="Wind from · °T"
                  onChange={setWindDirection}
                  value={windDirection}
                />
                <WindInput label="Steady · KT" onChange={setWindSpeed} value={windSpeed} />
                <WindInput label="Gust · KT" onChange={setWindGust} value={windGust} />
              </View>
              <Text
                accessibilityRole={runwayWind.kind === 'unavailable' ? 'alert' : undefined}
                style={[
                  panelStyles.copy,
                  styles.windState,
                  {
                    color: runwayWind.kind === 'ready' ? theme.secondary : theme.attention,
                  },
                ]}
              >
                {runwayWind.kind === 'ready'
                  ? `${runwayWind.directionTrue.toFixed(0).padStart(3, '0')}°T · ${runwayWind.steadySpeed.toFixed(0)} KT${runwayWind.gustSpeed === null ? '' : ` G ${runwayWind.gustSpeed.toFixed(0)} KT`}`
                  : runwayWind.reason.replaceAll('-', ' ').toUpperCase()}
              </Text>
              <View style={styles.windClear}>
                <Action
                  disabled={
                    windDirection.length === 0 &&
                    windSpeed.length === 0 &&
                    windGust.length === 0
                  }
                  label="Clear wind"
                  onPress={() => {
                    setWindDirection('');
                    setWindSpeed('');
                    setWindGust('');
                  }}
                />
              </View>
            </Card>
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
                      {runway.surface} · HDG {runway.headingTrueDegrees ?? '—'}°T
                    </Text>
                  </View>
                </View>
                {runway.headingTrueDegrees === null ? (
                  <Text
                    style={[panelStyles.copy, styles.windState, { color: theme.attention }]}
                  >
                    WIND COMPONENTS UNAVAILABLE · RUNWAY TRUE HEADING MISSING
                  </Text>
                ) : (
                  <View style={styles.runwayWindResults}>
                    <RunwayWindEnd
                      heading={runway.headingTrueDegrees}
                      label={runway.designator.split('/')[0] ?? runway.designator}
                      scenario={runwayWind}
                    />
                    <RunwayWindEnd
                      heading={trueDegrees((Number(runway.headingTrueDegrees) + 180) % 360)}
                      label={runway.designator.split('/')[1] ?? 'RECIPROCAL'}
                      scenario={runwayWind}
                    />
                  </View>
                )}
              </Card>
            ))}
            <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
              Computed solar events
            </Text>
            <Card>
              <Text style={[styles.warning, { color: theme.attention }]}>
                NOAA-DERIVED ASTRONOMICAL ESTIMATE · NOT OBSERVED
              </Text>
              <View style={styles.facts}>
                <Fact label="Airport local date" value={solarCalendarDate ?? 'UNAVAILABLE'} />
                <Fact
                  label="Sunrise UTC"
                  value={
                    solarEvents?.kind === 'available'
                      ? `${solarEvents.sunriseUtc.slice(0, 10)} ${solarEvents.sunriseUtc.slice(11, 16)}Z`
                      : 'UNAVAILABLE'
                  }
                />
                <Fact
                  label="Sunset UTC"
                  value={
                    solarEvents?.kind === 'available'
                      ? `${solarEvents.sunsetUtc.slice(0, 10)} ${solarEvents.sunsetUtc.slice(11, 16)}Z`
                      : 'UNAVAILABLE'
                  }
                />
                <Fact
                  label="Calculation state"
                  value={
                    solarEvents === null
                      ? 'CLOCK / TIMEZONE UNAVAILABLE'
                      : solarEvents.kind === 'available'
                        ? solarEvents.accuracy.replaceAll('-', ' ').toUpperCase()
                        : solarEvents.reason.replaceAll('-', ' ').toUpperCase()
                  }
                />
              </View>
              <Text
                style={[panelStyles.copy, styles.unavailableCopy, { color: theme.secondary }]}
              >
                Uses the selected coordinate, a 0.833° refraction assumption, and the airport's
                current local calendar date. NOAA says theoretical error increases beyond ±72°
                latitude and actual atmosphere can shift observed times. Do not infer legal
                day/night, lighting, or airport availability.
              </Text>
            </Card>
            <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
              Operational fields
            </Text>
            <Card>
              <Text style={[styles.warning, { color: theme.attention }]}>
                NOT PRESENT IN DEMONSTRATION DATASET
              </Text>
              <View style={styles.facts}>
                <Fact label="Frequencies" value="NOT SUPPLIED" />
                <Fact label="Services" value="NOT SUPPLIED" />
                <Fact label="Fuel" value="NOT SUPPLIED" />
                <Fact label="Operating notes" value="NOT SUPPLIED" />
                <Fact label="Current NOTAM" value="NOT AVAILABLE" />
              </View>
              <Text
                style={[panelStyles.copy, styles.unavailableCopy, { color: theme.secondary }]}
              >
                Absence is not evidence that a frequency, service, restriction, closure, or
                daylight condition does not exist. Consult approved current sources.
              </Text>
            </Card>
            <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
              Nearby demonstration airports
            </Text>
            {nearby.length === 0 ? (
              <Card>
                <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                  No other airports in the active fixture.
                </Text>
              </Card>
            ) : (
              nearby.map(({ airport, distanceNauticalMiles }) => (
                <Card key={airport.icao}>
                  <View style={panelStyles.row}>
                    <View style={styles.routeCopy}>
                      <Text style={[styles.runway, { color: theme.primary }]}>
                        {airport.icao}
                      </Text>
                      <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                        {airport.name} · {distanceNauticalMiles.toFixed(1)} NM GREAT-CIRCLE
                      </Text>
                    </View>
                    <Action label="Open" onPress={() => selectAirport(airport.icao)} />
                  </View>
                </Card>
              ))
            )}
            <View style={styles.actions}>
              <Action
                disabled={savingFavourite}
                label={
                  savingFavourite
                    ? 'Saving favourite…'
                    : favouriteIdentifiers.includes(selected.icao)
                      ? 'Remove favourite'
                      : 'Add favourite'
                }
                onPress={() => void toggleFavourite()}
              />
              <Action label="Add to route" onPress={() => addWaypoint(selected.icao)} />
              <Action
                label={`Direct to ${selected.icao}`}
                onPress={() => {
                  setDirectTo(selected.icao);
                  setWorkspace('map');
                }}
                primary
              />
              <Action label="Show map" onPress={() => setWorkspace('map')} />
            </View>
            {favouriteError !== null && (
              <Text
                accessibilityRole="alert"
                style={[styles.favouriteError, { color: theme.danger }]}
              >
                {favouriteError}
              </Text>
            )}
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

function WindInput({
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
    <View style={styles.windInputGroup}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onChangeText={onChange}
        selectTextOnFocus
        style={[
          styles.windInput,
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

function RunwayWindEnd({
  heading,
  label,
  scenario,
}: {
  readonly heading: TrueDegrees;
  readonly label: string;
  readonly scenario: RunwayWindInput;
}) {
  const theme = useDriftlineTheme();
  if (scenario.kind === 'unavailable') {
    return (
      <View style={styles.runwayWindEnd}>
        <Text style={[panelStyles.label, { color: theme.secondary }]}>RWY {label}</Text>
        <Text style={[panelStyles.copy, { color: theme.secondary }]}>INPUT REQUIRED</Text>
      </View>
    );
  }
  const steady = calculateRunwayWindComponents(
    heading,
    scenario.directionTrue,
    scenario.steadySpeed,
  );
  const gust =
    scenario.gustSpeed === null
      ? null
      : calculateRunwayWindComponents(heading, scenario.directionTrue, scenario.gustSpeed);
  const format = (value: ReturnType<typeof calculateRunwayWindComponents>): string =>
    `${value.longitudinal.kind.toUpperCase()} ${value.longitudinal.speed.toFixed(1)} KT · XWIND ${value.crosswind.speed.toFixed(1)} KT${value.crosswind.from === 'none' ? '' : ` FROM ${value.crosswind.from.toUpperCase()}`}`;
  return (
    <View style={styles.runwayWindEnd}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>
        RWY {label} · {heading.toFixed(0).padStart(3, '0')}°T
      </Text>
      <Text style={[panelStyles.value, styles.windResult, { color: theme.primary }]}>
        STEADY · {format(steady)}
      </Text>
      {gust !== null && (
        <Text style={[panelStyles.value, styles.windResult, { color: theme.attention }]}>
          GUST · {format(gust)}
        </Text>
      )}
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
  favouriteError: { fontFamily: typography.body, fontSize: 13, marginTop: spacing.md },
  layout: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.lg },
  pressed: { opacity: 0.7 },
  result: { borderRadius: radii.control, borderWidth: 1, minHeight: 70, padding: spacing.md },
  resultId: { fontFamily: typography.mono, fontSize: 15, fontWeight: '800' },
  resultName: { fontFamily: typography.body, fontSize: 11, lineHeight: 15, marginTop: 3 },
  relative: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  results: { flex: 1, gap: spacing.sm, minWidth: 210 },
  routeCopy: { flex: 1 },
  runway: { fontFamily: typography.mono, fontSize: 18, fontWeight: '800', minWidth: 70 },
  runwayWindEnd: { flex: 1, gap: spacing.xs, minWidth: 230 },
  runwayWindResults: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
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
  unavailableCopy: { marginTop: spacing.md },
  windClear: { alignItems: 'flex-start', marginTop: spacing.md },
  windInput: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.mono,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  windInputGroup: { flex: 1, gap: spacing.xs, minWidth: 130 },
  windInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  windResult: { fontFamily: typography.mono, fontSize: 11 },
  windState: { marginTop: spacing.md },
  warning: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
});
