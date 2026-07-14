import { spacing } from '@driftline/design-system';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  aircraftProfileSchema,
  calculateLoadingSummary,
  calculateWeightBalance,
  reviseAircraftProfile,
  type AircraftProfile,
} from '@driftline/aircraft-performance';
import { kilograms, metres } from '@driftline/data-contracts';

import {
  insertAircraftProfile,
  listAircraftProfiles,
  replaceAircraftProfile,
} from '@/database/aircraft-profile-repository';
import { parseTransientLoadingStations } from '@/domain/transient-loading-stations';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

const facts = [
  ['Profile', 'DL-GA-01'],
  ['Type', 'Generic educational single-engine'],
  ['Cruise planning speed', '118 KT'],
  ['Performance authority', 'None · demonstration only'],
] as const;

interface ProfileForm {
  readonly cgEnvelope: string;
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
  cgEnvelope: '',
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

const profileFormFromRecord = (profile: AircraftProfile): ProfileForm => ({
  cgEnvelope:
    profile.planning.cgEnvelope?.map(({ armM, massKg }) => `${armM},${massKg}`).join('\n') ??
    '',
  cruiseSpeedKt: String(profile.planning.cruiseSpeedKt),
  displayName: profile.displayName,
  emptyArmM: String(profile.planning.emptyArmM),
  emptyMassKg: String(profile.planning.emptyMassKg),
  fuelArmM: String(profile.planning.fuelArmM),
  fuelBurnLitresPerHour: String(profile.planning.fuelBurnLitresPerHour),
  maximumMassKg: String(profile.planning.maximumMassKg),
  occupantArmM: String(profile.planning.occupantArmM),
  registration: profile.registration,
  typeDesignator: profile.typeDesignator,
  usableFuelLitres: String(profile.planning.usableFuelLitres),
});

const envelopeFromForm = (value: string): AircraftProfile['planning']['cgEnvelope'] => {
  if (value.trim().length === 0) return null;
  const lines = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 3 || lines.length > 20) {
    throw new Error('CG envelope requires 3 to 20 non-empty points.');
  }
  return lines.map((line, index) => {
    const parts = line.split(',').map((part) => part.trim());
    if (parts.length !== 2) {
      throw new Error(`CG envelope line ${index + 1} must be arm M,mass KG.`);
    }
    return {
      armM: requiredNumber(parts[0] ?? '', `CG envelope line ${index + 1} arm`),
      massKg: requiredNumber(parts[1] ?? '', `CG envelope line ${index + 1} mass`),
    };
  });
};

const planningFromForm = (form: ProfileForm): AircraftProfile['planning'] => ({
  cgEnvelope: envelopeFromForm(form.cgEnvelope),
  cruiseSpeedKt: requiredNumber(form.cruiseSpeedKt, 'Cruise speed'),
  emptyArmM: requiredNumber(form.emptyArmM, 'Empty arm'),
  emptyMassKg: requiredNumber(form.emptyMassKg, 'Empty mass'),
  fuelArmM: requiredNumber(form.fuelArmM, 'Fuel arm'),
  fuelBurnLitresPerHour: requiredNumber(form.fuelBurnLitresPerHour, 'Fuel burn'),
  maximumMassKg: requiredNumber(form.maximumMassKg, 'Maximum mass'),
  occupantArmM: requiredNumber(form.occupantArmM, 'Occupant arm'),
  usableFuelLitres: requiredNumber(form.usableFuelLitres, 'Usable fuel'),
});

export function AircraftWorkspace() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [profiles, setProfiles] = useState<readonly AircraftProfile[]>([]);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(profileDefaults);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [emptyMass, setEmptyMass] = useState('700');
  const [occupantMass, setOccupantMass] = useState('160');
  const [fuelMass, setFuelMass] = useState('100');
  const [extraStations, setExtraStations] = useState('');
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
  const selectedProfile = profiles.find(({ id }) => id === selectedProfileId) ?? null;
  const extraStationScenario = useMemo(() => {
    try {
      return {
        kind: 'valid' as const,
        stations: parseTransientLoadingStations(extraStations),
      };
    } catch (caught) {
      return {
        kind: 'invalid' as const,
        message:
          caught instanceof Error ? caught.message : 'Extra loading stations are invalid.',
      };
    }
  }, [extraStations]);
  const profileLoading = useMemo(() => {
    if (selectedProfile === null) return null;
    if (extraStationScenario.kind === 'invalid') return null;
    const inputs = [occupantMass, fuelMass];
    if (inputs.some((value) => value.trim().length === 0)) return null;
    const values = inputs.map(Number);
    if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
    try {
      const input = {
        maximumMass: kilograms(selectedProfile.planning.maximumMassKg),
        stations: [
          {
            arm: metres(selectedProfile.planning.emptyArmM),
            id: 'empty-aircraft',
            mass: kilograms(selectedProfile.planning.emptyMassKg),
          },
          {
            arm: metres(selectedProfile.planning.occupantArmM),
            id: 'occupants',
            mass: kilograms(values[0] ?? Number.NaN),
          },
          {
            arm: metres(selectedProfile.planning.fuelArmM),
            id: 'fuel',
            mass: kilograms(values[1] ?? Number.NaN),
          },
          ...extraStationScenario.stations.map((station) => ({
            arm: metres(station.armMetres),
            id: station.id,
            mass: kilograms(station.massKilograms),
          })),
        ],
      };
      return selectedProfile.planning.cgEnvelope === null
        ? calculateLoadingSummary(input)
        : calculateWeightBalance({
            ...input,
            envelope: selectedProfile.planning.cgEnvelope.map(({ armM, massKg }) => ({
              arm: metres(armM),
              mass: kilograms(massKg),
            })),
          });
    } catch {
      return null;
    }
  }, [extraStationScenario, fuelMass, occupantMass, selectedProfile]);

  const reload = useCallback(async () => {
    try {
      setProfiles(await listAircraftProfiles(database));
      setProfileError(null);
      setReadBlocked(false);
      return true;
    } catch {
      setProfiles([]);
      setProfileError('Aircraft library unavailable: stored profiles failed integrity checks.');
      setReadBlocked(true);
      return false;
    }
  }, [database]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const planning = planningFromForm(profileForm);
      const editingProfile =
        editingProfileId === null
          ? null
          : (profiles.find(({ id }) => id === editingProfileId) ?? null);
      if (editingProfileId !== null && editingProfile === null) {
        throw new Error('Selected aircraft profile is no longer available.');
      }
      if (editingProfile === null) {
        const profile = aircraftProfileSchema.parse({
          createdAt: now,
          displayName: profileForm.displayName,
          id: randomUUID(),
          notes: '',
          planning,
          registration: profileForm.registration,
          revision: 1,
          source: 'user-entered',
          typeDesignator: profileForm.typeDesignator,
          units: { arm: 'm', fuel: 'l', mass: 'kg', speed: 'kt' },
          updatedAt: now,
          verificationStatus: 'unverified',
        });
        await insertAircraftProfile(database, profile);
      } else {
        const next = reviseAircraftProfile(
          editingProfile,
          {
            displayName: profileForm.displayName,
            notes: editingProfile.notes,
            planning,
            registration: profileForm.registration,
            typeDesignator: profileForm.typeDesignator,
          },
          now,
        );
        await replaceAircraftProfile(database, editingProfile.revision, next);
      }
      setProfileForm(profileDefaults());
      setEditingProfileId(null);
      await reload();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to save aircraft.';
      if (message === 'Aircraft profile changed on another writer.') {
        setEditingProfileId(null);
        setProfileForm(profileDefaults());
      }
      if (await reload()) setProfileError(message);
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
        profiles.map((profile) => (
          <SavedProfile
            key={profile.id}
            onEdit={() => {
              setEditingProfileId(profile.id);
              setProfileForm(profileFormFromRecord(profile));
            }}
            onUse={() => {
              setSelectedProfileId(profile.id);
              setExtraStations('');
            }}
            profile={profile}
            selected={profile.id === selectedProfileId}
          />
        ))
      )}
      {selectedProfile !== null && (
        <>
          <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
            Profile loading summary
          </Text>
          <Card>
            <Text style={[styles.warning, { color: theme.attention }]}>
              {selectedProfile.registration} · UNVERIFIED · USER-ENTERED LIMITS
            </Text>
            <Text style={[panelStyles.copy, styles.note, { color: theme.secondary }]}>
              Empty mass {selectedProfile.planning.emptyMassKg} KG is fixed from this profile.
              Enter occupant and fuel mass in kilograms; no litre-to-mass conversion is applied.
            </Text>
            <View style={styles.inputs}>
              <MassInput label="Occupants" onChange={setOccupantMass} value={occupantMass} />
              <MassInput label="Fuel" onChange={setFuelMass} value={fuelMass} />
            </View>
            <View style={[styles.inputGroup, styles.extraStations]}>
              <Text style={[panelStyles.label, { color: theme.secondary }]}>
                Extra transient stations · one LABEL,MASS KG,ARM M per line · optional
              </Text>
              <TextInput
                accessibilityLabel="Extra transient loading stations"
                autoCapitalize="words"
                autoCorrect={false}
                multiline
                onChangeText={setExtraStations}
                style={[
                  styles.input,
                  styles.multilineInput,
                  {
                    backgroundColor: theme.panelRaised,
                    borderColor:
                      extraStationScenario.kind === 'invalid' ? theme.danger : theme.separator,
                    color: theme.primary,
                  },
                ]}
                value={extraStations}
              />
              <Text
                style={[
                  panelStyles.copy,
                  {
                    color:
                      extraStationScenario.kind === 'invalid' ? theme.danger : theme.secondary,
                  },
                ]}
              >
                {extraStationScenario.kind === 'invalid'
                  ? extraStationScenario.message
                  : `${extraStationScenario.stations.length} EXTRA · SESSION ONLY · NOT SAVED`}
              </Text>
            </View>
            <View style={styles.outputs}>
              <Output
                label="Total mass"
                value={profileLoading === null ? '—' : `${profileLoading.totalMass} KG`}
              />
              <Output
                label="Calculated CG"
                value={
                  profileLoading === null
                    ? '—'
                    : `${profileLoading.centreOfGravityArm.toFixed(3)} M`
                }
              />
              <Output
                label="Total moment"
                value={
                  profileLoading === null
                    ? '—'
                    : `${profileLoading.totalMoment.toFixed(2)} KG·M`
                }
              />
              <Output
                label="Maximum mass"
                value={
                  profileLoading === null
                    ? 'INVALID INPUT'
                    : profileLoading.massWithinLimit
                      ? 'WITHIN ENTERED LIMIT'
                      : 'ABOVE ENTERED LIMIT'
                }
              />
              <Output
                label="CG envelope"
                value={
                  profileLoading === null
                    ? 'INVALID INPUT'
                    : !('insideEnvelope' in profileLoading)
                      ? 'NOT PROVIDED'
                      : profileLoading.insideEnvelope
                        ? 'INSIDE ENTERED ENVELOPE'
                        : 'OUTSIDE ENTERED ENVELOPE'
                }
              />
            </View>
          </Card>
        </>
      )}
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        {editingProfileId === null ? 'New profile' : 'Edit unverified profile'}
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
          <ProfileInput
            form={profileForm}
            label="CG envelope · one ARM M,MASS KG point per line · optional"
            multiline
            name="cgEnvelope"
            onChange={setProfileForm}
          />
        </View>
        <Text style={[panelStyles.copy, styles.envelopeHelp, { color: theme.secondary }]}>
          Enter polygon vertices in perimeter order. Example: 0.80,600. Leave empty to keep CG
          envelope evaluation unavailable.
        </Text>
        <View style={styles.save}>
          <Action
            disabled={saving || readBlocked}
            label={
              saving
                ? 'Saving…'
                : editingProfileId === null
                  ? 'Save offline'
                  : 'Update revision'
            }
            onPress={() => void saveProfile()}
            primary
          />
          {editingProfileId !== null && (
            <Action
              disabled={saving}
              label="Cancel edit"
              onPress={() => {
                setEditingProfileId(null);
                setProfileForm(profileDefaults());
              }}
            />
          )}
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
  multiline = false,
  name,
  numeric = false,
  onChange,
}: {
  readonly form: ProfileForm;
  readonly label: string;
  readonly multiline?: boolean;
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
        multiline={multiline}
        onChangeText={(value) => onChange({ ...form, [name]: value })}
        style={[
          styles.input,
          multiline && styles.multilineInput,
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

function SavedProfile({
  onEdit,
  onUse,
  profile,
  selected,
}: {
  readonly onEdit: () => void;
  readonly onUse: () => void;
  readonly profile: AircraftProfile;
  readonly selected: boolean;
}) {
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
      <Text style={[panelStyles.copy, { color: theme.secondary }]}>
        CG envelope:{' '}
        {profile.planning.cgEnvelope === null
          ? 'not provided'
          : `${profile.planning.cgEnvelope.length} user-entered points`}
      </Text>
      <View style={styles.profileAction}>
        <Action
          disabled={selected}
          label={selected ? 'Selected' : 'Use for loading'}
          onPress={onUse}
        />
        <Action label="Edit values" onPress={onEdit} />
      </View>
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
  envelopeHelp: { marginTop: spacing.md },
  error: { fontSize: 13, marginTop: spacing.md },
  extraStations: { marginTop: spacing.lg },
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
  multilineInput: { minHeight: 112, paddingTop: spacing.md, textAlignVertical: 'top' },
  note: { marginTop: spacing.lg, maxWidth: 680 },
  output: { gap: spacing.xs, minWidth: 150 },
  outputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  outputValue: { fontFamily: 'Menlo', fontSize: 16, fontWeight: '800' },
  profileAction: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  save: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
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
