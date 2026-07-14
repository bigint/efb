import { radii, spacing, typography } from '@driftline/design-system';
import { estimateDensityAltitude } from '@driftline/aircraft-performance';
import { feet, isTrustedRealProvenance } from '@driftline/data-contracts';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, AppState, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import {
  awcMetarClient,
  classifyUsFlightCategory,
  evaluateMetarCurrency,
  evaluateTafValidity,
  parseMetar,
  parseTafTimeline,
  type AwcTafReport,
  type MetarObservation,
} from '@driftline/weather';

import { useDriftlineTheme } from '@/theme';
import {
  cacheMetar,
  cacheTaf,
  clearCachedWeather,
  deleteCachedWeather,
  listCachedWeather,
  type CachedWeather,
} from '@/database/weather-cache-repository';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

interface DecoderForm {
  readonly raw: string;
}

export function WeatherWorkspace() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [cached, setCached] = useState<readonly CachedWeather[]>([]);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [cacheActionStatus, setCacheActionStatus] = useState<string | null>(null);
  const [deletingCache, setDeletingCache] = useState(false);
  const [metarCached, setMetarCached] = useState(false);
  const [observation, setObservation] = useState<MetarObservation | null>(null);
  const [taf, setTaf] = useState<AwcTafReport | null>(null);
  const [station, setStation] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [tafCached, setTafCached] = useState(false);
  const [weatherClock, setWeatherClock] = useState(() => new Date());
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
  } = useForm<DecoderForm>({ defaultValues: { raw: '' } });

  const reloadCache = useCallback(async () => {
    try {
      setCached(await listCachedWeather(database));
      setCacheError(null);
    } catch {
      setCached([]);
      setCacheError('Local weather cache unavailable; live and manual tools remain available.');
    }
  }, [database]);

  useEffect(() => {
    void reloadCache();
  }, [reloadCache]);

  useEffect(() => {
    if (observation === null && taf === null) return undefined;
    const refreshClock = () => setWeatherClock(new Date());
    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    };
    const start = () => {
      if (interval !== null) return;
      refreshClock();
      interval = setInterval(refreshClock, 30_000);
    };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [observation, taf]);

  const decode = ({ raw }: DecoderForm) => {
    const receivedAt = new Date().toISOString();
    try {
      const parsed = parseMetar({
        provenance: {
          confidence: 'unknown',
          datasetVersion: 'manual-input-v1',
          effectiveAt: null,
          expiresAt: null,
          jurisdiction: 'USER_SUPPLIED',
          origin: 'real',
          retrievedAt: receivedAt,
          source: 'Unverified manual user input',
          sourceTimestamp: null,
          verificationStatus: 'unverified',
        },
        raw,
        receivedAt,
      });
      setObservation(parsed);
      setMetarCached(false);
    } catch {
      setObservation(null);
      setError('raw', {
        message: 'Could not resolve a valid station and UTC observation-time boundary.',
      });
    }
  };

  const clear = () => {
    reset({ raw: '' });
    setObservation(null);
    setMetarCached(false);
  };

  const fetchLive = async () => {
    setLoadingLive(true);
    try {
      const latest = await awcMetarClient.fetchLatest(station);
      setObservation(latest);
      setMetarCached(false);
      try {
        await cacheMetar(database, latest);
        await reloadCache();
        setLiveError(null);
      } catch {
        setLiveError('Live METAR shown, but its local cache write failed.');
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Live weather lookup failed.';
      setLiveError(
        observation === null ? message : `${message} Previous decoded report retained.`,
      );
    } finally {
      setLoadingLive(false);
    }
  };

  const fetchLiveTaf = async () => {
    setLoadingLive(true);
    try {
      const latest = await awcMetarClient.fetchLatestTaf(station);
      setTaf(latest);
      setTafCached(false);
      try {
        await cacheTaf(database, latest);
        await reloadCache();
        setLiveError(null);
      } catch {
        setLiveError('Live raw TAF shown, but its local cache write failed.');
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Live TAF lookup failed.';
      setLiveError(taf === null ? message : `${message} Previous raw TAF retained.`);
    } finally {
      setLoadingLive(false);
    }
  };

  const clearLoadedCachedProduct = (product: 'METAR' | 'TAF', stationCode: string) => {
    if (product === 'METAR' && metarCached && observation?.station === stationCode) {
      setObservation(null);
      setMetarCached(false);
    }
    if (product === 'TAF' && tafCached && taf?.station === stationCode) {
      setTaf(null);
      setTafCached(false);
    }
  };

  const removeCachedProduct = async (product: 'METAR' | 'TAF', stationCode: string) => {
    setDeletingCache(true);
    try {
      const removed = await deleteCachedWeather(database, product, stationCode);
      clearLoadedCachedProduct(product, stationCode);
      await reloadCache();
      setCacheActionStatus(
        removed
          ? `${stationCode} ${product} was removed from local cache.`
          : `${stationCode} ${product} was already absent; the cache list was refreshed.`,
      );
    } catch {
      setCacheActionStatus(`${stationCode} ${product} could not be removed from local cache.`);
    } finally {
      setDeletingCache(false);
    }
  };

  const confirmRemoveCachedProduct = (product: 'METAR' | 'TAF', stationCode: string) => {
    Alert.alert(
      'Remove cached weather?',
      `${stationCode} ${product} raw text and retrieval metadata will be deleted from this device.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void removeCachedProduct(product, stationCode),
          style: 'destructive',
          text: 'Remove',
        },
      ],
    );
  };

  const clearAllCachedProducts = async () => {
    setDeletingCache(true);
    try {
      const removed = await clearCachedWeather(database);
      if (metarCached) {
        setObservation(null);
        setMetarCached(false);
      }
      if (tafCached) {
        setTaf(null);
        setTafCached(false);
      }
      await reloadCache();
      setCacheActionStatus(
        `${removed} cached weather ${removed === 1 ? 'product was' : 'products were'} removed from this device.`,
      );
    } catch {
      setCacheActionStatus('The local weather cache could not be cleared.');
    } finally {
      setDeletingCache(false);
    }
  };

  const confirmClearAllCachedProducts = () => {
    Alert.alert(
      'Clear all cached weather?',
      'Every cached METAR and TAF raw product will be deleted from this device. Live and manual tools remain available.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void clearAllCachedProducts(),
          style: 'destructive',
          text: 'Clear all',
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="LIVE RAW LOOKUP + MANUAL DECODER" title="Weather" />
      <Card>
        <Text style={[styles.warning, { color: theme.attention }]}>
          NOAA/NWS AWC · SUPPLEMENTAL WEATHER ONLY
        </Text>
        <Text style={[panelStyles.copy, styles.intro, { color: theme.secondary }]}>
          Retrieve one latest raw METAR or TAF by four-character station identifier. All AWC
          products share one foreground-only request limit of once per minute. This is not a
          complete weather briefing. Successful raw reports are cached locally with their
          retrieval timestamps.
        </Text>
        <View style={styles.liveRow}>
          <TextInput
            accessibilityLabel="Live weather station identifier"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
            onChangeText={setStation}
            placeholder="KMCI"
            placeholderTextColor={theme.secondary}
            style={[
              styles.input,
              styles.stationInput,
              {
                backgroundColor: theme.background,
                borderColor: liveError === null ? theme.separator : theme.danger,
                color: theme.primary,
              },
            ]}
            value={station}
          />
          <Action
            disabled={loadingLive}
            label={loadingLive ? 'Retrieving…' : 'Get latest METAR'}
            onPress={() => void fetchLive()}
            primary
          />
          <Action
            disabled={loadingLive}
            label={loadingLive ? 'Retrieving…' : 'Get latest TAF'}
            onPress={() => void fetchLiveTaf()}
          />
        </View>
        {liveError !== null && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {liveError}
          </Text>
        )}
        <View style={styles.actions}>
          <Action
            disabled={loadingLive || observation === null}
            label="Clear displayed METAR"
            onPress={() => {
              setObservation(null);
              setMetarCached(false);
            }}
          />
          <Action
            disabled={loadingLive || taf === null}
            label="Clear displayed TAF"
            onPress={() => {
              setTaf(null);
              setTafCached(false);
            }}
          />
        </View>
      </Card>
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Timestamped local cache
      </Text>
      <Card>
        <Text style={[styles.warning, { color: theme.attention }]}>
          CACHED RAW PRODUCTS · NOT A CURRENT BRIEFING
        </Text>
        {cacheError !== null && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {cacheError}
          </Text>
        )}
        {cached.length === 0 && cacheError === null ? (
          <Text style={[panelStyles.copy, styles.intro, { color: theme.secondary }]}>
            No cached AWC reports.
          </Text>
        ) : (
          <View style={styles.cacheList}>
            {cached.map((record) => {
              const value = record.product === 'METAR' ? record.observation : record.report;
              return (
                <View
                  key={`${record.product}-${value.station}`}
                  style={[styles.cacheRow, { borderColor: theme.separator }]}
                >
                  <View style={styles.cacheCopy}>
                    <Text style={[styles.cacheTitle, { color: theme.primary }]}>
                      {value.station} · {record.product}
                    </Text>
                    <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                      Retrieved UTC {value.receivedAt}
                    </Text>
                  </View>
                  <Action
                    disabled={deletingCache}
                    label="Load cached"
                    onPress={() => {
                      setStation(value.station);
                      if (record.product === 'METAR') {
                        setObservation(record.observation);
                        setMetarCached(true);
                      } else {
                        setTaf(record.report);
                        setTafCached(true);
                      }
                    }}
                  />
                  <Action
                    destructive
                    disabled={deletingCache}
                    label="Remove"
                    onPress={() => confirmRemoveCachedProduct(record.product, value.station)}
                  />
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.cacheRefresh}>
          <Action
            disabled={deletingCache}
            label="Refresh cache"
            onPress={() => void reloadCache()}
          />
          <Action
            destructive
            disabled={deletingCache || (cached.length === 0 && cacheError === null)}
            label={deletingCache ? 'Updating cache…' : 'Clear all cached weather'}
            onPress={confirmClearAllCachedProducts}
          />
        </View>
        {cacheActionStatus !== null && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.secondary }]}>
            {cacheActionStatus}
          </Text>
        )}
      </Card>
      {taf !== null && <RawTaf cached={tafCached} now={weatherClock} report={taf} />}
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Manual offline decoder
      </Text>
      <Card>
        <Text style={[styles.warning, { color: theme.attention }]}>
          UNVERIFIED INPUT · NOT CURRENT WEATHER
        </Text>
        <Text style={[panelStyles.copy, styles.intro, { color: theme.secondary }]}>
          Paste a METAR or SPECI for conservative local decoding. This tool never upgrades
          manual text into a verified briefing.
        </Text>
        <Controller
          control={control}
          name="raw"
          rules={{ required: 'Enter a raw METAR or SPECI.' }}
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              accessibilityLabel="Raw METAR or SPECI"
              autoCapitalize="characters"
              autoCorrect={false}
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="METAR KAAA 141200Z 22008KT 10SM FEW030 24/12 Q1014"
              placeholderTextColor={theme.secondary}
              style={[
                styles.input,
                {
                  backgroundColor: theme.background,
                  borderColor: errors.raw === undefined ? theme.separator : theme.danger,
                  color: theme.primary,
                },
              ]}
              value={value}
            />
          )}
        />
        {errors.raw?.message !== undefined && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {errors.raw.message}
          </Text>
        )}
        <View style={styles.actions}>
          <Action primary label="Decode locally" onPress={() => void handleSubmit(decode)()} />
          <Action label="Clear" onPress={clear} />
        </View>
      </Card>

      {observation !== null && (
        <DecodedObservation cached={metarCached} now={weatherClock} observation={observation} />
      )}
    </ScrollView>
  );
}

function RawTaf({
  cached,
  now,
  report,
}: {
  readonly cached: boolean;
  readonly now: Date;
  readonly report: AwcTafReport;
}) {
  const theme = useDriftlineTheme();
  const validity = evaluateTafValidity(report, now);
  let timeline: ReturnType<typeof parseTafTimeline> | null = null;
  try {
    timeline = parseTafTimeline(report);
  } catch {
    timeline = null;
  }
  return (
    <View style={styles.decoded}>
      <View>
        <Text style={[styles.station, { color: theme.primary }]}>
          {report.station} · RAW TAF
        </Text>
        <Text style={[styles.sourceState, { color: theme.attention }]}>
          {cached ? 'CACHED RAW · ' : ''}VALIDITY{' '}
          {validity.kind === 'current'
            ? 'CURRENT'
            : validity.reason.replaceAll('-', ' ').toUpperCase()}{' '}
          · WEATHER CONDITIONS NOT DECODED
        </Text>
      </View>
      <Card>
        <Text selectable style={[styles.rawReport, { color: theme.primary }]}>
          {report.raw}
        </Text>
      </Card>
      <Card>
        <Fact label="Issue state" value={report.amendment.toUpperCase()} />
        <Fact label="Issued UTC" value={report.issuedAt} />
        <Fact label="Valid from UTC" value={report.validFrom} />
        <Fact label="Valid to UTC" value={report.validTo} />
        <Fact label="Source" value={report.provenance.source} />
        <Fact label="Retrieved UTC" value={report.receivedAt} />
      </Card>
      <Card>
        <Text style={[styles.sourceState, { color: theme.attention }]}>
          CHANGE MARKERS ONLY ·{' '}
          {timeline === null ? 'UNAVAILABLE' : `${timeline.groups.length} IDENTIFIED`} · RAW
          CONDITIONS
        </Text>
        {timeline === null ? (
          <Text style={[styles.error, { color: theme.danger }]}>
            Change-marker structure failed conservative validation. Use the complete raw TAF.
          </Text>
        ) : (
          <View style={styles.tafGroups}>
            <View style={[styles.tafGroup, { borderColor: theme.separator }]}>
              <Fact label="Base forecast · overall validity" value={timeline.baseForecastRaw} />
            </View>
            {timeline.groups.map((group, index) => (
              <View
                key={`${group.marker}-${index}`}
                style={[styles.tafGroup, { borderColor: theme.separator }]}
              >
                <Fact
                  label={`${group.kind.replaceAll('-', ' ').toUpperCase()} · ${group.marker}`}
                  value={group.rawConditions}
                />
                <Text style={[styles.tafTiming, { color: theme.secondary }]}>
                  START {group.startsAt}
                  {group.endsAt === null ? ' · END NOT EXPLICIT' : ` · END ${group.endsAt}`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

function DecodedObservation({
  cached,
  now,
  observation,
}: {
  readonly cached: boolean;
  readonly now: Date;
  readonly observation: MetarObservation;
}) {
  const theme = useDriftlineTheme();
  const currency = evaluateMetarCurrency(observation, now);
  const flightCategory = classifyUsFlightCategory(observation);
  const wind = observation.wind;
  const visibility = observation.visibility;
  const visibilityPrefix =
    visibility?.bound === 'greater-than' ? '>' : visibility?.bound === 'less-than' ? '<' : '';
  return (
    <View style={styles.decoded}>
      <View>
        <Text style={[styles.station, { color: theme.primary }]}>
          {observation.station} · {observation.kind.toUpperCase()}
        </Text>
        <Text
          style={[
            styles.sourceState,
            { color: currency.kind === 'current' ? theme.accent : theme.danger },
          ]}
        >
          {cached ? 'CACHED · ' : ''}CURRENCY{' '}
          {currency.kind === 'current' ? 'CURRENT' : currency.reason.toUpperCase()}
        </Text>
        <Text style={[styles.sourceState, { color: theme.attention }]}>
          U.S. NWS DISPLAY CATEGORY ·{' '}
          {flightCategory.kind === 'classified'
            ? `${flightCategory.category} · ${flightCategory.limitingFactor.toUpperCase()}`
            : `UNAVAILABLE · ${flightCategory.reason.replaceAll('-', ' ').toUpperCase()}`}
        </Text>
      </View>
      <Card>
        <View style={styles.facts}>
          <Fact label="Observed UTC" value={observation.observedAt} />
          <Fact
            label="Wind °T"
            value={
              wind === null
                ? '—'
                : `${wind.direction === null ? 'VRB' : String(wind.direction).padStart(3, '0')} / ${wind.speed} KT${wind.gust === null ? '' : ` G${wind.gust}`}`
            }
          />
          <Fact
            label="Visibility"
            value={
              visibility === null
                ? '—'
                : `${visibilityPrefix}${(visibility.metres / 1_000).toFixed(1)} KM`
            }
          />
          <Fact
            label="Temperature / dewpoint"
            value={`${observation.temperature ?? '—'} / ${observation.dewpoint ?? '—'} °C`}
          />
          <Fact
            label="Altimeter"
            value={
              observation.altimeter === null ? '—' : `${observation.altimeter.toFixed(1)} HPA`
            }
          />
          <Fact
            label="Clouds"
            value={
              observation.clouds.length === 0
                ? '—'
                : observation.clouds
                    .map((layer) =>
                      layer.baseFeetAgl === null
                        ? layer.amount
                        : `${layer.amount} ${layer.baseFeetAgl} FT AGL${layer.convectiveType === null ? '' : ` ${layer.convectiveType}`}`,
                    )
                    .join(' · ')
            }
          />
          <Fact
            label="U.S. display category evidence"
            value={
              flightCategory.kind === 'classified'
                ? `CEILING ${flightCategory.ceilingFeetAgl === null ? 'NONE REPORTED' : `${flightCategory.ceilingFeetAgl} FT AGL`} · VIS ${flightCategory.visibilityBound === 'greater-than' ? '>' : flightCategory.visibilityBound === 'less-than' ? '<' : ''}${flightCategory.visibilityStatuteMiles.toFixed(1)} SM`
                : 'INSUFFICIENT PARSED CEILING / VISIBILITY'
            }
          />
        </View>
      </Card>
      <DensityAltitudeTool
        trustedCurrent={
          currency.kind === 'current' && isTrustedRealProvenance(observation.provenance)
        }
        observation={observation}
      />
      <Card>
        <Fact label="Source" value={observation.provenance.source} />
        <Fact label="Retrieved UTC" value={observation.receivedAt} />
        <Fact
          label="Present-weather codes (not interpreted)"
          value={observation.presentWeatherCodes.join(' · ') || 'None parsed'}
        />
        <Fact
          label="Unsupported body groups"
          value={observation.unparsedBodyGroups.join(' · ') || 'None'}
        />
        <Fact label="Raw remarks" value={observation.remarks ?? 'None'} />
      </Card>
    </View>
  );
}

function DensityAltitudeTool({
  observation,
  trustedCurrent,
}: {
  readonly observation: MetarObservation;
  readonly trustedCurrent: boolean;
}) {
  const theme = useDriftlineTheme();
  const [expanded, setExpanded] = useState(false);
  const [fieldElevation, setFieldElevation] = useState('');
  const trimmedElevation = fieldElevation.trim();
  const elevationValid = /^-?\d{1,5}$/u.test(trimmedElevation);
  const elevation = elevationValid ? Number(trimmedElevation) : null;
  const estimate =
    trustedCurrent &&
    elevation !== null &&
    observation.altimeter !== null &&
    observation.temperature !== null
      ? estimateDensityAltitude({
          altimeterHectopascals: observation.altimeter,
          fieldElevationFeet: feet(elevation),
          outsideAirTemperatureCelsius: observation.temperature,
        })
      : null;
  const inputAvailable =
    trustedCurrent && observation.altimeter !== null && observation.temperature !== null;

  return (
    <View style={styles.densityTool}>
      <Action
        expanded={expanded}
        label={expanded ? 'Close density-altitude estimate' : 'Estimate density altitude'}
        onPress={() => setExpanded((value) => !value)}
      />
      {expanded && (
        <Animated.View
          entering={FadeInDown.duration(320)}
          exiting={FadeOutUp.duration(220)}
          style={styles.densityPanel}
        >
          <Card>
            <Text style={[styles.warning, { color: theme.attention }]}>RULE-OF-THUMB ONLY</Text>
            <Text style={[panelStyles.copy, styles.intro, { color: theme.secondary }]}>
              FAA approximation using this report's temperature and altimeter setting. It is not
              aircraft performance data and cannot determine runway suitability.
            </Text>
            {!inputAvailable ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
                Unavailable: a current trusted real-source report with parsed temperature and
                altimeter setting is required.
              </Text>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Field elevation in feet"
                  keyboardType="numbers-and-punctuation"
                  maxLength={6}
                  onChangeText={setFieldElevation}
                  placeholder="Field elevation · FT"
                  placeholderTextColor={theme.secondary}
                  style={[
                    styles.input,
                    styles.densityInput,
                    {
                      backgroundColor: theme.background,
                      borderColor:
                        trimmedElevation.length === 0 ||
                        (elevationValid && estimate?.kind !== 'unavailable')
                          ? theme.separator
                          : theme.danger,
                      color: theme.primary,
                    },
                  ]}
                  value={fieldElevation}
                />
                {trimmedElevation.length === 0 ? (
                  <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                    Enter the published field elevation from a current, appropriate source.
                  </Text>
                ) : !elevationValid || estimate?.kind === 'unavailable' ? (
                  <Text
                    accessibilityRole="alert"
                    style={[styles.error, { color: theme.danger }]}
                  >
                    Unavailable outside the documented educational approximation boundary.
                  </Text>
                ) : estimate?.kind === 'ready' ? (
                  <View style={styles.facts}>
                    <Fact
                      label="Estimated density altitude"
                      value={`${Math.round(estimate.densityAltitudeFeet).toLocaleString('en-US')} FT`}
                    />
                    <Fact
                      label="Approx. pressure altitude"
                      value={`${Math.round(estimate.pressureAltitudeFeet).toLocaleString('en-US')} FT`}
                    />
                    <Fact
                      label="Approx. ISA temperature"
                      value={`${estimate.isaTemperatureCelsius.toFixed(1)} °C`}
                    />
                  </View>
                ) : null}
              </>
            )}
          </Card>
        </Animated.View>
      )}
    </View>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.fact}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text selectable style={[panelStyles.value, { color: theme.primary }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  cacheCopy: { flex: 1 },
  cacheList: { marginTop: spacing.md },
  cacheRefresh: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cacheRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  cacheTitle: { fontFamily: typography.mono, fontSize: 13, fontWeight: '800' },
  decoded: { gap: spacing.md, marginTop: spacing.xl },
  densityInput: { minHeight: 48, textAlignVertical: 'center', width: 280 },
  densityPanel: { width: '100%' },
  densityTool: { alignItems: 'flex-start', gap: spacing.md },
  error: {
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  fact: { gap: spacing.xs, minWidth: 180 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  input: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.mono,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.lg,
    minHeight: 120,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  intro: { marginTop: spacing.sm, maxWidth: 720 },
  liveRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  rawReport: { fontFamily: typography.mono, fontSize: 13, lineHeight: 20 },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  sourceState: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.xs,
  },
  station: { fontFamily: typography.mono, fontSize: 24, fontWeight: '800' },
  stationInput: { minHeight: 48, minWidth: 140, width: 180 },
  tafGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  tafGroups: { marginTop: spacing.md },
  tafTiming: { fontFamily: typography.mono, fontSize: 10 },
  warning: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
