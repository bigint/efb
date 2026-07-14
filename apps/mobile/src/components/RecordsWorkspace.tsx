import {
  formatLogbookDuration,
  logbookEntrySchema,
  parseLogbookDuration,
  summariseLogbook,
  type LogbookEntry,
} from '@driftline/aviation-domain';
import { radii, spacing, typography } from '@driftline/design-system';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { insertLogbookEntry, listLogbookEntries } from '@/database/logbook-repository';
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

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function RecordsWorkspace() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [entries, setEntries] = useState<readonly LogbookEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, reset } = useForm<LogbookForm>({ defaultValues: defaults() });

  const reload = useCallback(async () => {
    try {
      const records = await listLogbookEntries(database);
      setEntries(records);
      setError(null);
      setReadBlocked(false);
    } catch {
      setEntries([]);
      setError('Logbook unavailable: stored records did not pass integrity checks.');
      setReadBlocked(true);
    }
  }, [database]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = handleSubmit(async (form) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const flightMinutes = parseLogbookDuration(form.flightTime);
      const nightMinutes = parseLogbookDuration(form.nightTime);
      const entry = logbookEntrySchema.parse({
        aircraftId: null,
        aircraftRegistration: form.aircraftRegistration,
        approaches: 0,
        arrivalIdentifier: form.arrivalIdentifier,
        attachmentIds: [],
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
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save logbook entry.');
    } finally {
      setSaving(false);
    }
  });

  const summary = summariseLogbook(entries);

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
        Recent entries
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
