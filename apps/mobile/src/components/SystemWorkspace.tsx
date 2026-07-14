import { demoAirports } from '@driftline/aviation-domain';
import { radii, spacing, typography } from '@driftline/design-system';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { parseSimulationProfileText } from '@/domain/simulation-profile';
import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme, useHighContrastEnabled } from '@/theme';
import { evaluatePosition } from '@/domain/position-source';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';
import { OfflineDataPanel } from './OfflineDataPanel';

export function SystemWorkspace() {
  const theme = useDriftlineTheme();
  const highContrast = useHighContrastEnabled();
  const scenario = useFlightStore((state) => state.positionScenario);
  const sample = useFlightStore((state) => state.positionSample);
  const simulationProfile = useFlightStore((state) => state.simulationProfile);
  const setSimulationProfile = useFlightStore((state) => state.setSimulationProfile);
  const [altitudeFeet, setAltitudeFeet] = useState(String(simulationProfile.altitudeFeet));
  const [groundspeedKnots, setGroundspeedKnots] = useState(
    String(simulationProfile.groundspeedKnots),
  );
  const [horizontalAccuracyMetres, setHorizontalAccuracyMetres] = useState(
    String(simulationProfile.horizontalAccuracyMetres),
  );
  const [startingAirportIdentifier, setStartingAirportIdentifier] = useState(
    simulationProfile.startingAirportIdentifier,
  );
  const [trackTrueDegrees, setTrackTrueDegrees] = useState(
    String(simulationProfile.trackTrueDegrees),
  );
  const [verticalSpeedFeetPerMinute, setVerticalSpeedFeetPerMinute] = useState(
    String(simulationProfile.verticalSpeedFeetPerMinute),
  );
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const setGpsOutage = useFlightStore((state) => state.setGpsOutage);
  const setDevicePositionEnabled = useFlightStore((state) => state.setDevicePositionEnabled);
  const setDevicePositionStatus = useFlightStore((state) => state.setDevicePositionStatus);
  const setSimulationEnabled = useFlightStore((state) => state.setSimulationEnabled);
  const simulation = scenario.kind === 'simulated';
  const device = scenario.kind === 'device';
  const gpsOutage = scenario.kind === 'simulated' && !scenario.gpsAvailable;
  const position = evaluatePosition(scenario, sample, Date.now());

  const setDeviceEnabled = async (enabled: boolean) => {
    if (!enabled) {
      setDevicePositionEnabled(false);
      return;
    }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setDevicePositionEnabled(true);
      if (!permission.granted) {
        setDevicePositionStatus(
          permission.canAskAgain ? 'permission-required' : 'permission-denied',
        );
      }
    } catch {
      setDevicePositionEnabled(true);
      setDevicePositionStatus('error');
    }
  };

  const applySimulationProfile = () => {
    try {
      setSimulationProfile(
        parseSimulationProfileText({
          altitudeFeet,
          groundspeedKnots,
          horizontalAccuracyMetres,
          startingAirportIdentifier,
          trackTrueDegrees,
          verticalSpeedFeetPerMinute,
        }),
      );
      setSimulationError(null);
    } catch (caught) {
      setSimulationError(
        caught instanceof Error ? caught.message : 'Simulation profile is invalid.',
      );
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="EVIDENCE & RECOVERY" title="System" />
      <Card>
        <Setting
          detail="Requests foreground permission and uses platform location only while the app is active."
          label="Device position"
          onValueChange={(enabled) => void setDeviceEnabled(enabled)}
          value={device}
        />
        <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        <Setting
          detail="Persistent visual framing identifies every simulated position."
          label="Simulation source"
          onValueChange={setSimulationEnabled}
          value={simulation}
        />
        <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        <Setting
          disabled={!simulation}
          detail="Inject a complete position-source failure and block derived GPS values."
          label="GPS outage injection"
          onValueChange={setGpsOutage}
          value={gpsOutage}
        />
      </Card>
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Simulation profile
      </Text>
      <Card>
        <Text style={[styles.simulationNotice, { color: theme.simulation }]}>
          SIMULATED KINEMATICS · TRUE TRACK · NOT ATTITUDE OR HEADING
        </Text>
        <Text style={[panelStyles.label, styles.profileLabel, { color: theme.secondary }]}>
          Starting airport
        </Text>
        <View style={styles.profileActions}>
          {demoAirports.map((airport) => (
            <Action
              key={airport.icao}
              label={`${airport.icao}${startingAirportIdentifier === airport.icao ? ' · selected' : ''}`}
              onPress={() => setStartingAirportIdentifier(airport.icao)}
              primary={startingAirportIdentifier === airport.icao}
            />
          ))}
        </View>
        <View style={styles.profileGrid}>
          <SimulationInput
            label="Altitude · FT"
            onChange={setAltitudeFeet}
            value={altitudeFeet}
          />
          <SimulationInput
            label="Groundspeed · KT"
            onChange={setGroundspeedKnots}
            value={groundspeedKnots}
          />
          <SimulationInput
            label="True track · °T"
            onChange={setTrackTrueDegrees}
            value={trackTrueDegrees}
          />
          <SimulationInput
            label="Vertical speed · FT/MIN"
            onChange={setVerticalSpeedFeetPerMinute}
            value={verticalSpeedFeetPerMinute}
          />
          <SimulationInput
            label="Horizontal accuracy · M"
            onChange={setHorizontalAccuracyMetres}
            value={horizontalAccuracyMetres}
          />
        </View>
        <View style={styles.applyProfile}>
          <Action label="Apply and restart sample" onPress={applySimulationProfile} primary />
        </View>
        {simulationError !== null && (
          <Text
            accessibilityRole="alert"
            style={[styles.profileError, { color: theme.danger }]}
          >
            {simulationError}
          </Text>
        )}
        <Text style={[panelStyles.copy, styles.profileHelp, { color: theme.secondary }]}>
          Supported bounds: altitude −4,000–100,000 FT, speed 0–2,000 KT, track 0–&lt;360°T,
          vertical speed ±10,000 FT/MIN. Applying clears the previous sample and restores GPS
          availability if simulation is active.
        </Text>
      </Card>
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Data status
      </Text>
      <Card>
        <Status label="Airport dataset" value="demo-2026-07-14 · unverified" />
        <Status label="Map base" value="offline graticule · no chart data" />
        <Status
          label="Simulation profile"
          value={`${simulationProfile.startingAirportIdentifier} · ${simulationProfile.groundspeedKnots} KT · ${simulationProfile.trackTrueDegrees.toFixed(0).padStart(3, '0')}°T · ${simulationProfile.altitudeFeet.toLocaleString('en-US')} FT · ${simulationProfile.verticalSpeedFeetPerMinute >= 0 ? '+' : ''}${simulationProfile.verticalSpeedFeetPerMinute} FT/MIN`}
        />
        <Status label="Weather" value="AWC on-demand METAR/TAF · no cache · not a briefing" />
        <Status
          label="System contrast"
          value={highContrast ? 'high-contrast palette active' : 'standard palette'}
        />
        <Status
          label="Position"
          value={
            position.kind === 'available'
              ? `${position.origin} · ${position.sample.horizontalAccuracyMetres === null ? 'accuracy unknown' : `±${position.sample.horizontalAccuracyMetres.toFixed(0)} m`} · ${Math.floor(position.ageMilliseconds / 1000)} s old`
              : `unavailable · ${position.reason.replaceAll('-', ' ')}`
          }
        />
      </Card>
      <OfflineDataPanel />
      <Text style={[styles.safety, { color: theme.danger }]}>
        NOT APPROVED AS A PRIMARY NAVIGATION INSTRUMENT
      </Text>
      <Text style={[panelStyles.copy, { color: theme.secondary }]}>
        This development slice is for simulation, education, and architecture validation. It
        contains fictional airports and no licensed chart, NOTAM, obstacle, terrain, or current
        weather data.
      </Text>
    </ScrollView>
  );
}

function SimulationInput({
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
    <View style={styles.profileField}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        onChangeText={onChange}
        selectTextOnFocus
        style={[
          styles.profileInput,
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

function Setting({
  disabled = false,
  detail,
  label,
  onValueChange,
  value,
}: {
  readonly disabled?: boolean;
  readonly detail: string;
  readonly label: string;
  readonly onValueChange: (value: boolean) => void;
  readonly value: boolean;
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.setting}>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingLabel, { color: theme.primary }]}>{label}</Text>
        <Text style={[panelStyles.copy, { color: theme.secondary }]}>{detail}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onValueChange}
        value={value}
      />
    </View>
  );
}

function Status({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.status}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text style={[panelStyles.value, { color: theme.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  applyProfile: { alignItems: 'flex-start', marginTop: spacing.lg },
  profileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  profileError: { fontFamily: typography.body, fontSize: 13, marginTop: spacing.md },
  profileField: { flex: 1, gap: spacing.xs, minWidth: 150 },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  profileHelp: { marginTop: spacing.md },
  profileInput: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.mono,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  profileLabel: { marginBottom: spacing.sm, marginTop: spacing.lg },
  safety: {
    fontFamily: 'Menlo',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: spacing.lg },
  setting: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  settingCopy: { flex: 1 },
  settingLabel: { fontFamily: 'Avenir Next', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  simulationNotice: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  status: { gap: spacing.xs, marginBottom: spacing.lg },
});
