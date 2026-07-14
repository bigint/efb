import { spacing } from '@driftline/design-system';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  aircraftProfileSchema,
  calculateWeightBalance,
  type AircraftProfile,
} from '@driftline/aircraft-performance';
import { kilograms, metres } from '@driftline/data-contracts';

import {
  insertAircraftProfile,
  listAircraftProfiles,
} from '@/database/aircraft-profile-repository';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

const facts = [
  ['Profile', 'DL-GA-01'],
  ['Type', 'Generic educational single-engine'],
  ['Cruise planning speed', '118 KT'],
  ['Performance authority', 'None · demonstration only'],
] as const;

interface ProfileForm {
  readonly cruiseSpeedKt: string;
  readonly displayName: string;
  readonly emptyArmM: string;
  readonly emptyMassKg: string;
  readonly fuelArmM: string;
  readonly fuelBurnLitresPerHour: string;
  readonly maximumMassKg: string;
  readonly occupantArmM: string;
  readonly registration: string;
  readonly typeDesignator: string;
  readonly usableFuelLitres: string;
}

const profileDefaults = (): ProfileForm => ({
  cruiseSpeedKt: '',
  displayName: '',
  emptyArmM: '',
  emptyMassKg: '',
  fuelArmM: '',
  fuelBurnLitresPerHour: '',
  maximumMassKg: '',
  occupantArmM: '',
  registration: '',
  typeDesignator: '',
  usableFuelLitres: '',
});

const requiredNumber = (value: string, label: string): number => {
  if (value.trim().length === 0) throw new Error(`${label} is required.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
};

export function AircraftWorkspace() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [profiles, setProfiles] = useState<readonly AircraftProfile[]>([]);
  const [profileForm, setProfileForm] = useState<ProfileForm>(profileDefaults);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emptyMass, setEmptyMass] = useState('700');
  const [occupantMass, setOccupantMass] = useState('160');
  const [fuelMass, setFuelMass] = useState('100');
  const result = useMemo(() => {
    const inputs = [emptyMass, occupantMass, fuelMass];
    if (inputs.some((value) => value.trim().length === 0)) return null;
    const values = inputs.map(Number);
    if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
    try {
      return calculateWeightBalance({
        envelope: [
          { arm: metres(0.8), mass: kilograms(600) },
          { arm: metres(1.05), mass: kilograms(600) },
          { arm: metres(1.05), mass: kilograms(1_200) },
          { arm: metres(0.9), mass: kilograms(1_200) },
        ],
        maximumMass: kilograms(1_200),
        stations: [
          { arm: metres(0.9), id: 'empty-aircraft', mass: kilograms(values[0] ?? Number.NaN) },
          { arm: metres(1.2), id: 'occupants', mass: kilograms(values[1] ?? Number.NaN) },
          { arm: metres(1), id: 'fuel', mass: kilograms(values[2] ?? Number.NaN) },
        ],
      });
    } catch {
      return null;
    }
  }, [emptyMass, fuelMass, occupantMass]);

  const reload = useCallback(async () => {
    try {
      setProfiles(await listAircraftProfiles(database));
      setProfileError(null);
      setReadBlocked(false);
    } catch {
      setProfiles([]);
      setProfileError('Aircraft library unavailable: stored profiles failed integrity checks.');
      setReadBlocked(true);
    }
  }, [database]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const profile = aircraftProfileSchema.parse({
        createdAt: now,
        displayName: profileForm.displayName,
        id: randomUUID(),
        notes: '',
        planning: {
          cruiseSpeedKt: requiredNumber(profileForm.cruiseSpeedKt, 'Cruise speed'),
          emptyArmM: requiredNumber(profileForm.emptyArmM, 'Empty arm'),
          emptyMassKg: requiredNumber(profileForm.emptyMassKg, 'Empty mass'),
          fuelArmM: requiredNumber(profileForm.fuelArmM, 'Fuel arm'),
          fuelBurnLitresPerHour: requiredNumber(profileForm.fuelBurnLitresPerHour, 'Fuel burn'),
          maximumMassKg: requiredNumber(profileForm.maximumMassKg, 'Maximum mass'),
          occupantArmM: requiredNumber(profileForm.occupantArmM, 'Occupant arm'),
          usableFuelLitres: requiredNumber(profileForm.usableFuelLitres, 'Usable fuel'),
        },
        registration: profileForm.registration,
        revision: 1,
        source: 'user-entered',
        typeDesignator: profileForm.typeDesignator,
        units: { arm: 'm', fuel: 'l', mass: 'kg', speed: 'kt' },
        updatedAt: now,
        verificationStatus: 'unverified',
      });
      await insertAircraftProfile(database, profile);
      setProfileForm(profileDefaults());
      await reload();
    } catch (caught) {
      setProfileError(caught instanceof Error ? caught.message : 'Unable to save aircraft.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="LOCAL AIRCRAFT DATA" title="Aircraft" />
      <Text style={[styles.warning, { color: theme.attention }]}>USER DATA · UNVERIFIED</Text>
      <Text style={[panelStyles.copy, styles.note, { color: theme.secondary }]}>
        Saved values are planning notes, not approved aircraft data. Verify every value and unit
        against the current aircraft documents before use.
      </Text>
      {profileError !== null && (
        <Text style={[styles.error, { color: theme.danger }]}>{profileError}</Text>
      )}
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Saved profiles
      </Text>
      {profiles.length === 0 ? (
        <Card>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>No saved aircraft.</Text>
        </Card>
      ) : (
        profiles.map((profile) => <SavedProfile key={profile.id} profile={profile} />)
      )}
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        New profile
      </Text>
      <Card>
        <View style={styles.inputs}>
          <ProfileInput
            form={profileForm}
            label="Display name"
            name="displayName"
            onChange={setProfileForm}
          />
          <ProfileInput
            form={profileForm}
            label="Registration"
            name="registration"
            onChange={setProfileForm}
          />
          <ProfileInput
            form={profileForm}
            label="Type designator"
            name="typeDesignator"
            onChange={setProfileForm}
          />
          <ProfileInput
            form={profileForm}
            label="Cruise · KT"
            name="cruiseSpeedKt"
            onChange={setProfileForm}
            numeric
          />
          <ProfileInput
            form={profileForm}
            label="Empty mass · KG"
            name="emptyMassKg"
            onChange={setProfileForm}
            numeric
          />
          <ProfileInput
            form={profileForm}
            label="Maximum mass · KG"
            name="maximumMassKg"
            onChange={setProfileForm}
            numeric
          />
          <ProfileInput
            form={profileForm}
            label="Empty arm · M"
            name="emptyArmM"
            onChange={setProfileForm}
            numeric
          />
          <ProfileInput
            form={profileForm}
            label="Occupant arm · M"
            name="occupantArmM"
            onChange={setProfileForm}
            numeric
          />
          <ProfileInput
            form={profileForm}
            label="Fuel arm · M"
            name="fuelArmM"
            onChange={setProfileForm}
            numeric
          />
          <ProfileInput
            form={profileForm}
            label="Usable fuel · L"
            name="usableFuelLitres"
            onChange={setProfileForm}
            numeric
          />
          <ProfileInput
            form={profileForm}
            label="Fuel burn · L/H"
            name="fuelBurnLitresPerHour"
            onChange={setProfileForm}
            numeric
          />
        </View>
        <View style={styles.save}>
          <Action
            disabled={saving || readBlocked}
            label={saving ? 'Saving…' : 'Save offline'}
            onPress={() => void saveProfile()}
            primary
          />
        </View>
      </Card>
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Built-in demonstration profile
      </Text>
      <Card>
        <Text style={[styles.name, { color: theme.primary }]}>Driftline GA Trainer</Text>
        <Text style={[styles.warning, { color: theme.attention }]}>
          FICTIONAL · NO CERTIFIED PERFORMANCE DATA
        </Text>
        <View style={styles.facts}>
          {facts.map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
              <Text style={[panelStyles.value, { color: theme.primary }]}>{value}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Educational loading sandbox
      </Text>
      <Card>
        <Text style={[styles.warning, { color: theme.attention }]}>
          GENERIC GEOMETRY · NOT AN AIRCRAFT FLIGHT MANUAL
        </Text>
        <View style={styles.inputs}>
          <MassInput label="Empty aircraft" onChange={setEmptyMass} value={emptyMass} />
          <MassInput label="Occupants" onChange={setOccupantMass} value={occupantMass} />
          <MassInput label="Fuel" onChange={setFuelMass} value={fuelMass} />
        </View>
        <View style={styles.outputs}>
          <Output label="Total mass" value={result === null ? '—' : `${result.totalMass} KG`} />
          <Output
            label="CG arm"
            value={result === null ? '—' : `${result.centreOfGravityArm.toFixed(3)} M`}
          />
          <Output
            label="Demo envelope"
            value={
              result === null
                ? 'INVALID INPUT'
                : result.violations.length === 0
                  ? 'INSIDE'
                  : result.violations.join(' · ').toUpperCase()
            }
          />
        </View>
      </Card>
      <Text style={[panelStyles.copy, styles.note, { color: theme.secondary }]}>
        This sandbox proves typed mass, arm, moment, and polygon-envelope boundaries only.
        Aircraft-specific weight, balance, take-off, landing, climb, and fuel models remain
        blocked until their source, revision, interpolation rules, and legal distribution rights
        are explicit. Never transfer these values into a real loading decision.
      </Text>
    </ScrollView>
  );
}

function ProfileInput({
  form,
  label,
  name,
  numeric = false,
  onChange,
}: {
  readonly form: ProfileForm;
  readonly label: string;
  readonly name: keyof ProfileForm;
  readonly numeric?: boolean;
  readonly onChange: (value: ProfileForm) => void;
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.inputGroup}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={name === 'displayName' ? 'words' : 'characters'}
        autoCorrect={false}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        onChangeText={(value) => onChange({ ...form, [name]: value })}
        style={[
          styles.input,
          {
            backgroundColor: theme.panelRaised,
            borderColor: theme.separator,
            color: theme.primary,
          },
        ]}
        value={form[name]}
      />
    </View>
  );
}

function SavedProfile({ profile }: { readonly profile: AircraftProfile }) {
  const theme = useDriftlineTheme();
  return (
    <View style={[styles.savedProfile, { borderColor: theme.separator }]}>
      <View>
        <Text style={[styles.name, { color: theme.primary }]}>{profile.displayName}</Text>
        <Text style={[panelStyles.copy, { color: theme.secondary }]}>
          {profile.registration} · {profile.typeDesignator} · revision {profile.revision}
        </Text>
      </View>
      <Text style={[styles.warning, { color: theme.attention }]}>
        {profile.planning.cruiseSpeedKt} KT · {profile.planning.usableFuelLitres} L · UNVERIFIED
      </Text>
    </View>
  );
}

function MassInput({
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
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label} · KG</Text>
      <TextInput
        accessibilityLabel={`${label} mass in kilograms`}
        keyboardType="decimal-pad"
        onChangeText={onChange}
        selectTextOnFocus
        style={[
          styles.input,
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

function Output({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.output}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text style={[styles.outputValue, { color: theme.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 13, marginTop: spacing.md },
  fact: { gap: spacing.xs, minWidth: 210 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, marginTop: spacing.xl },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: 'Menlo',
    fontSize: 18,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inputGroup: { flex: 1, gap: spacing.xs, minWidth: 150 },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  name: { fontFamily: 'Avenir Next Condensed', fontSize: 24, fontWeight: '700' },
  note: { marginTop: spacing.lg, maxWidth: 680 },
  output: { gap: spacing.xs, minWidth: 150 },
  outputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  outputValue: { fontFamily: 'Menlo', fontSize: 16, fontWeight: '800' },
  save: { alignItems: 'flex-start', marginTop: spacing.lg },
  savedProfile: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.lg },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  warning: {
    fontFamily: 'Menlo',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
});
