import { radii, spacing, typography } from '@driftline/design-system';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  awcMetarClient,
  evaluateMetarCurrency,
  parseMetar,
  type AwcTafReport,
  type MetarObservation,
} from '@driftline/weather';

import { useDriftlineTheme } from '@/theme';
import {
  cacheMetar,
  cacheTaf,
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
  const [metarCached, setMetarCached] = useState(false);
  const [observation, setObservation] = useState<MetarObservation | null>(null);
  const [taf, setTaf] = useState<AwcTafReport | null>(null);
  const [station, setStation] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [tafCached, setTafCached] = useState(false);
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
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.cacheRefresh}>
          <Action label="Refresh cache" onPress={() => void reloadCache()} />
        </View>
      </Card>
      {taf !== null && <RawTaf cached={tafCached} report={taf} />}
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
        <DecodedObservation cached={metarCached} observation={observation} />
      )}
    </ScrollView>
  );
}

function RawTaf({
  cached,
  report,
}: {
  readonly cached: boolean;
  readonly report: AwcTafReport;
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.decoded}>
      <View>
        <Text style={[styles.station, { color: theme.primary }]}>
          {report.station} · RAW TAF
        </Text>
        <Text style={[styles.sourceState, { color: theme.attention }]}>
          {cached ? 'CACHED RAW · ' : ''}VALIDITY NOT EVALUATED · GROUPS NOT DECODED
        </Text>
      </View>
      <Card>
        <Text selectable style={[styles.rawReport, { color: theme.primary }]}>
          {report.raw}
        </Text>
      </Card>
      <Card>
        <Fact label="Source" value={report.provenance.source} />
        <Fact label="Retrieved UTC" value={report.receivedAt} />
      </Card>
    </View>
  );
}

function DecodedObservation({
  cached,
  observation,
}: {
  readonly cached: boolean;
  readonly observation: MetarObservation;
}) {
  const theme = useDriftlineTheme();
  const currency = evaluateMetarCurrency(observation, new Date());
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
        </View>
      </Card>
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
  cacheRefresh: { alignItems: 'flex-start', marginTop: spacing.md },
  cacheRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  cacheTitle: { fontFamily: typography.mono, fontSize: 13, fontWeight: '800' },
  decoded: { gap: spacing.md, marginTop: spacing.xl },
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
  warning: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
