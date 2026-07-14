import { radii, spacing, typography } from '@driftline/design-system';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  awcMetarClient,
  evaluateMetarCurrency,
  parseMetar,
  type MetarObservation,
} from '@driftline/weather';

import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

interface DecoderForm {
  readonly raw: string;
}

export function WeatherWorkspace() {
  const theme = useDriftlineTheme();
  const [observation, setObservation] = useState<MetarObservation | null>(null);
  const [station, setStation] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
  } = useForm<DecoderForm>({ defaultValues: { raw: '' } });

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
  };

  const fetchLive = async () => {
    setLoadingLive(true);
    try {
      setObservation(await awcMetarClient.fetchLatest(station));
      setLiveError(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Live weather lookup failed.';
      setLiveError(
        observation === null ? message : `${message} Previous decoded report retained.`,
      );
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
      <PanelHeader eyebrow="LIVE LOOKUP + MANUAL DECODER" title="Weather" />
      <Card>
        <Text style={[styles.warning, { color: theme.attention }]}>
          NOAA/NWS AWC · SUPPLEMENTAL WEATHER ONLY
        </Text>
        <Text style={[panelStyles.copy, styles.intro, { color: theme.secondary }]}>
          Retrieve one latest raw METAR by four-character station identifier. Requests are
          foreground-only and locally limited to one per minute. This is not a complete weather
          briefing and no offline cache is retained.
        </Text>
        <View style={styles.liveRow}>
          <TextInput
            accessibilityLabel="Live METAR station identifier"
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
        </View>
        {liveError !== null && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {liveError}
          </Text>
        )}
      </Card>
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

      {observation !== null && <DecodedObservation observation={observation} />}
    </ScrollView>
  );
}

function DecodedObservation({ observation }: { readonly observation: MetarObservation }) {
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
          CURRENCY {currency.kind === 'current' ? 'CURRENT' : currency.reason.toUpperCase()}
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
