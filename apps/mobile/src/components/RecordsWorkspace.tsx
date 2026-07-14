import {
  formatLogbookDuration,
  logbookEntrySchema,
  parseLogbookDuration,
  type DocumentRecord,
  type LogbookEntry,
  type LogbookSummary,
} from '@driftline/aviation-domain';
import type { AircraftProfile } from '@driftline/aircraft-performance';
import { radii, spacing, typography } from '@driftline/design-system';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { listAircraftProfiles } from '@/database/aircraft-profile-repository';
import { listDocuments } from '@/database/document-repository';
import { insertLogbookEntry, loadLogbookDashboard } from '@/database/logbook-repository';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

interface LogbookForm {
  readonly aircraftRegistration: string;
  readonly arrivalIdentifier: string;
  readonly blockTime: string;
  readonly departureIdentifier: string;
  readonly flightDate: string;
  readonly flightTime: string;
  readonly nightTime: string;
  readonly picTime: string;
  readonly remarks: string;
}

const defaults = (): LogbookForm => ({
  aircraftRegistration: '',
  arrivalIdentifier: '',
  blockTime: '1:30',
  departureIdentifier: '',
  flightDate: localDate(new Date()),
  flightTime: '1:15',
  nightTime: '0:00',
  picTime: '1:15',
  remarks: '',
});

const emptySummary: LogbookSummary = {
  entries: 0,
  jurisdictions: [],
  regulatoryComplianceEvaluated: false,
  totals: {
    blockMinutes: 0,
    dayMinutes: 0,
    dualMinutes: 0,
    flightMinutes: 0,
    instructorMinutes: 0,
    instrumentMinutes: 0,
    landingsDay: 0,
    landingsNight: 0,
    nightMinutes: 0,
    picMinutes: 0,
    sicMinutes: 0,
  },
};

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function RecordsWorkspace() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [aircraft, setAircraft] = useState<readonly AircraftProfile[]>([]);
  const [attachmentIds, setAttachmentIds] = useState<readonly string[]>([]);
  const [documents, setDocuments] = useState<readonly DocumentRecord[]>([]);
  const [entries, setEntries] = useState<readonly LogbookEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<LogbookSummary>(emptySummary);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const { control, handleSubmit, reset, setValue } = useForm<LogbookForm>({
    defaultValues: defaults(),
  });

  const reload = useCallback(async () => {
    try {
      const dashboard = await loadLogbookDashboard(database);
      setEntries(dashboard.entries);
      setSummary(dashboard.summary);
      setError(null);
      setReadBlocked(false);
    } catch {
      setEntries([]);
      setSummary(emptySummary);
      setError('Logbook unavailable: stored records did not pass integrity checks.');
      setReadBlocked(true);
    }
  }, [database]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reloadReferences = useCallback(async () => {
    try {
      const [storedAircraft, storedDocuments] = await Promise.all([
        listAircraftProfiles(database),
        listDocuments(database),
      ]);
      setAircraft(storedAircraft);
      setDocuments(storedDocuments);
      setReferenceError(null);
    } catch {
      setAircraft([]);
      setAttachmentIds([]);
      setDocuments([]);
      setSelectedAircraftId(null);
      setReferenceError(
        'Aircraft and document references unavailable; logbook entries remain accessible.',
      );
    }
  }, [database]);

  useEffect(() => {
    void reloadReferences();
  }, [reloadReferences]);

  const save = handleSubmit(async (form) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const flightMinutes = parseLogbookDuration(form.flightTime);
      const nightMinutes = parseLogbookDuration(form.nightTime);
      const selectedAircraft =
        selectedAircraftId === null
          ? null
          : (aircraft.find(({ id }) => id === selectedAircraftId) ?? null);
      if (selectedAircraftId !== null && selectedAircraft === null) {
        throw new Error('Selected aircraft reference is no longer available.');
      }
      if (
        selectedAircraft !== null &&
        form.aircraftRegistration.trim().toUpperCase() !== selectedAircraft.registration
      ) {
        throw new Error('Aircraft registration no longer matches the selected profile.');
      }
      const entry = logbookEntrySchema.parse({
        aircraftId: selectedAircraftId,
        aircraftRegistration: form.aircraftRegistration,
        approaches: 0,
        arrivalIdentifier: form.arrivalIdentifier,
        attachmentIds,
        blockMinutes: parseLogbookDuration(form.blockTime),
        compliance: { jurisdiction: 'UNCLASSIFIED', status: 'not-evaluated' },
        createdAt: now,
        dayMinutes: flightMinutes - nightMinutes,
        departureIdentifier: form.departureIdentifier,
        dualMinutes: 0,
        flightDate: form.flightDate,
        flightMinutes,
        id: randomUUID(),
        instructorMinutes: 0,
        instrumentMinutes: 0,
        landingsDay: 0,
        landingsNight: 0,
        nightMinutes,
        picMinutes: parseLogbookDuration(form.picTime),
        remarks: form.remarks,
        sicMinutes: 0,
        updatedAt: now,
      });
      await insertLogbookEntry(database, entry);
      reset(defaults());
      setAttachmentIds([]);
      setSelectedAircraftId(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save logbook entry.');
    } finally {
      setSaving(false);
    }
  });

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="LOCAL PILOT RECORDS" title="Logbook" />
      <View style={styles.summaryGrid}>
        <Summary label="Entries" value={String(summary.entries)} />
        <Summary label="Flight" value={formatLogbookDuration(summary.totals.flightMinutes)} />
        <Summary label="PIC" value={formatLogbookDuration(summary.totals.picMinutes)} />
        <Summary label="Night" value={formatLogbookDuration(summary.totals.nightMinutes)} />
      </View>
      <Text style={[styles.notice, { color: theme.attention }]}>COMPLIANCE NOT EVALUATED</Text>
      <Text style={[panelStyles.copy, styles.noticeCopy, { color: theme.secondary }]}>
        This local ledger does not determine whether an entry satisfies any regulator, licence,
        recency, endorsement, or record-retention requirement.
      </Text>

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Add entry
      </Text>
      <Card>
        <View style={styles.fieldGrid}>
          <Field control={control} label="Date · YYYY-MM-DD" name="flightDate" />
          <Field control={control} label="Aircraft registration" name="aircraftRegistration" />
          <Field control={control} label="Departure" name="departureIdentifier" />
          <Field control={control} label="Arrival" name="arrivalIdentifier" />
          <Field control={control} label="Block · H:MM" name="blockTime" />
          <Field control={control} label="Flight · H:MM" name="flightTime" />
          <Field control={control} label="PIC · H:MM" name="picTime" />
          <Field control={control} label="Night · H:MM" name="nightTime" />
          <Field control={control} label="Remarks" multiline name="remarks" />
        </View>
        <Text style={[panelStyles.label, styles.referenceHeading, { color: theme.secondary }]}>
          Saved aircraft reference
        </Text>
        <View style={styles.referenceActions}>
          <Action
            disabled={selectedAircraftId === null}
            label={
              selectedAircraftId === null
                ? 'Manual registration · selected'
                : 'Use manual registration'
            }
            onPress={() => setSelectedAircraftId(null)}
          />
          {aircraft.map((profile) => (
            <Action
              disabled={selectedAircraftId === profile.id}
              key={profile.id}
              label={`${profile.registration}${selectedAircraftId === profile.id ? ' · selected' : ''}`}
              onPress={() => {
                setSelectedAircraftId(profile.id);
                setValue('aircraftRegistration', profile.registration, {
                  shouldValidate: true,
                });
              }}
            />
          ))}
        </View>
        <Text style={[panelStyles.label, styles.referenceHeading, { color: theme.secondary }]}>
          Document attachments · {attachmentIds.length}/20
        </Text>
        <View style={styles.referenceActions}>
          {documents.length === 0 ? (
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              No imported documents available.
            </Text>
          ) : (
            documents.map((document) => {
              const selected = attachmentIds.includes(document.id);
              return (
                <Action
                  disabled={!selected && attachmentIds.length >= 20}
                  key={document.id}
                  label={`${selected ? '✓ ' : ''}${document.displayName}`}
                  onPress={() =>
                    setAttachmentIds((current) =>
                      current.includes(document.id)
                        ? current.filter((id) => id !== document.id)
                        : [...current, document.id],
                    )
                  }
                />
              );
            })
          )}
        </View>
        {referenceError !== null && (
          <Text style={[styles.error, { color: theme.attention }]}>{referenceError}</Text>
        )}
        <View style={styles.save}>
          <Action
            disabled={saving || readBlocked}
            label={saving ? 'Saving…' : 'Save offline'}
            onPress={() => void save()}
            primary
          />
        </View>
        {error !== null && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      </Card>

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Recent entries · showing {entries.length} of {summary.entries}
      </Text>
      {entries.length === 0 ? (
        <Card>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>No saved entries.</Text>
        </Card>
      ) : (
        entries.map((entry) => <LogbookRow entry={entry} key={entry.id} />)
      )}
    </ScrollView>
  );
}

function Field({
  control,
  label,
  multiline = false,
  name,
}: {
  readonly control: ReturnType<typeof useForm<LogbookForm>>['control'];
  readonly label: string;
  readonly multiline?: boolean;
  readonly name: keyof LogbookForm;
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={[styles.field, multiline && styles.fieldWide]}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextInput
            accessibilityLabel={label}
            autoCapitalize={
              name === 'aircraftRegistration' ||
              name === 'arrivalIdentifier' ||
              name === 'departureIdentifier'
                ? 'characters'
                : 'none'
            }
            autoCorrect={false}
            multiline={multiline}
            onBlur={onBlur}
            onChangeText={onChange}
            spellCheck={false}
            style={[
              styles.input,
              multiline && styles.multiline,
              {
                backgroundColor: theme.panel,
                borderColor: theme.separator,
                color: theme.primary,
              },
            ]}
            value={value}
          />
        )}
      />
    </View>
  );
}

function Summary({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={[styles.summary, { backgroundColor: theme.panelRaised }]}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: theme.primary }]}>{value}</Text>
    </View>
  );
}

function LogbookRow({ entry }: { readonly entry: LogbookEntry }) {
  const theme = useDriftlineTheme();
  return (
    <View style={[styles.entry, { borderColor: theme.separator }]}>
      <View style={styles.entryHeading}>
        <View>
          <Text style={[styles.route, { color: theme.primary }]}>
            {entry.departureIdentifier} → {entry.arrivalIdentifier}
          </Text>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>
            {entry.flightDate} · {entry.aircraftRegistration}
          </Text>
        </View>
        <Text style={[styles.time, { color: theme.accent }]}>
          {formatLogbookDuration(entry.flightMinutes)}
        </Text>
      </View>
      {entry.remarks.length > 0 && (
        <Text style={[panelStyles.copy, styles.remarks, { color: theme.secondary }]}>
          {entry.remarks}
        </Text>
      )}
      {entry.attachmentIds.length > 0 && (
        <Text style={[panelStyles.copy, styles.remarks, { color: theme.secondary }]}>
          {entry.attachmentIds.length} document attachment
          {entry.attachmentIds.length === 1 ? '' : 's'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.lg },
  entryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  error: { fontFamily: typography.body, fontSize: 13, marginTop: spacing.md },
  field: { flexBasis: 180, flexGrow: 1, gap: spacing.xs },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fieldWide: { flexBasis: '100%' },
  input: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.mono,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  notice: { fontFamily: typography.mono, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  noticeCopy: { marginTop: spacing.xs },
  remarks: { marginTop: spacing.sm },
  referenceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  referenceHeading: { marginBottom: spacing.sm, marginTop: spacing.lg },
  route: { fontFamily: typography.display, fontSize: 17, fontWeight: '700' },
  save: { alignItems: 'flex-start', marginTop: spacing.lg },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  summary: {
    borderRadius: radii.control,
    flex: 1,
    gap: spacing.xs,
    minWidth: 108,
    padding: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryValue: { fontFamily: typography.mono, fontSize: 19, fontWeight: '800' },
  time: { fontFamily: typography.mono, fontSize: 17, fontWeight: '800' },
});
