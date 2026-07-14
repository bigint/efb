import {
  abandonChecklistRun,
  checklistTemplateSchema,
  setChecklistItemCompleted,
  type ChecklistCategory,
  type ChecklistRun,
  type ChecklistTemplate,
} from '@driftline/aviation-domain';
import type { AircraftProfile } from '@driftline/aircraft-performance';
import { radii, spacing, typography } from '@driftline/design-system';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createChecklistRun,
  insertChecklistTemplate,
  listChecklistTemplates,
  listRecentTerminalChecklistRuns,
  loadLatestOpenChecklistRun,
  persistChecklistRunTransition,
} from '@/database/checklist-repository';
import { listAircraftProfiles } from '@/database/aircraft-profile-repository';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';
import { DocumentsPanel } from './DocumentsPanel';

interface ChecklistFormItem {
  readonly challenge: string;
  readonly isCritical: boolean;
  readonly response: string;
}

interface ChecklistForm {
  readonly aircraftLabel: string;
  readonly items: ChecklistFormItem[];
  readonly title: string;
}

const formDefaults = (): ChecklistForm => ({
  aircraftLabel: '',
  items: [{ challenge: '', isCritical: false, response: '' }],
  title: '',
});

const categories = ['normal', 'abnormal', 'emergency'] as const;

export function LibraryWorkspace() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [activeRun, setActiveRun] = useState<ChecklistRun | null>(null);
  const [aircraft, setAircraft] = useState<readonly AircraftProfile[]>([]);
  const [aircraftError, setAircraftError] = useState<string | null>(null);
  const [category, setCategory] = useState<ChecklistCategory>('normal');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly ChecklistRun[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<readonly ChecklistTemplate[]>([]);
  const { control, handleSubmit, reset, setValue } = useForm<ChecklistForm>({
    defaultValues: formDefaults(),
  });
  const { append, fields, remove } = useFieldArray({ control, name: 'items' });

  const reload = useCallback(async () => {
    try {
      const [storedTemplates, run] = await Promise.all([
        listChecklistTemplates(database),
        loadLatestOpenChecklistRun(database),
      ]);
      setTemplates(storedTemplates);
      setActiveRun(run);
      setError(null);
      setReadBlocked(false);
    } catch {
      setTemplates([]);
      setActiveRun(null);
      setError('Checklist library unavailable: stored records did not pass integrity checks.');
      setReadBlocked(true);
    }
  }, [database]);

  const reloadHistory = useCallback(async () => {
    try {
      setHistory(await listRecentTerminalChecklistRuns(database));
      setHistoryError(null);
    } catch {
      setHistory([]);
      setHistoryError(
        'Checklist history unavailable: stored runs did not pass integrity checks.',
      );
    }
  }, [database]);

  useEffect(() => {
    void reload();
    void reloadHistory();
  }, [reload, reloadHistory]);

  const reloadAircraft = useCallback(async () => {
    try {
      setAircraft(await listAircraftProfiles(database));
      setAircraftError(null);
    } catch {
      setAircraft([]);
      setSelectedAircraftId(null);
      setAircraftError(
        'Aircraft references unavailable; free-text source labels remain usable.',
      );
    }
  }, [database]);

  useEffect(() => {
    void reloadAircraft();
  }, [reloadAircraft]);

  const saveTemplate = handleSubmit(async (form) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const selectedAircraft =
        selectedAircraftId === null
          ? null
          : (aircraft.find(({ id }) => id === selectedAircraftId) ?? null);
      if (selectedAircraftId !== null && selectedAircraft === null) {
        throw new Error('Selected aircraft reference is no longer available.');
      }
      const template = checklistTemplateSchema.parse({
        aircraftId: selectedAircraft?.id ?? null,
        aircraftLabel:
          selectedAircraft === null ? form.aircraftLabel : selectedAircraft.registration,
        category,
        createdAt: now,
        id: randomUUID(),
        items: form.items.map((item, sequence) => ({ ...item, sequence })),
        revision: 1,
        source: 'user-authored',
        title: form.title,
        updatedAt: now,
        verificationStatus: 'unverified',
      });
      await insertChecklistTemplate(database, template);
      reset(formDefaults());
      setCategory('normal');
      setSelectedAircraftId(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save checklist.');
    } finally {
      setSaving(false);
    }
  });

  const begin = async (template: ChecklistTemplate) => {
    setSaving(true);
    try {
      const run = await createChecklistRun(
        database,
        template,
        randomUUID(),
        new Date().toISOString(),
      );
      setActiveRun(run);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to start checklist.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (sequence: number) => {
    if (activeRun === null || activeRun.completedAt !== null || activeRun.abandonedAt !== null)
      return;
    setSaving(true);
    const changedAt = new Date().toISOString();
    try {
      const completed = activeRun.completedSequences.includes(sequence);
      const next = setChecklistItemCompleted(activeRun, sequence, !completed, changedAt);
      await persistChecklistRunTransition(database, activeRun, next, changedAt);
      setActiveRun(next);
      setError(null);
      if (next.completedAt !== null) await reloadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update checklist.');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const abandonActiveRun = async () => {
    if (activeRun === null) return;
    setSaving(true);
    const changedAt = new Date().toISOString();
    try {
      const next = abandonChecklistRun(activeRun, changedAt);
      await persistChecklistRunTransition(database, activeRun, next, changedAt);
      setActiveRun(null);
      setError(null);
      await reloadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to abandon checklist.');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const confirmAbandon = () => {
    if (activeRun === null) return;
    Alert.alert(
      'Abandon active checklist?',
      `${activeRun.templateSnapshot.title} will be locked as incomplete and retained in history.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void abandonActiveRun(),
          style: 'destructive',
          text: 'Abandon',
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
      <PanelHeader eyebrow="LOCAL LIBRARY" title="Library" />
      <DocumentsPanel />
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Checklists
      </Text>
      <Text style={[styles.notice, { color: theme.attention }]}>
        USER-AUTHORED · UNVERIFIED
      </Text>
      <Text style={[panelStyles.copy, styles.noticeCopy, { color: theme.secondary }]}>
        Driftline ships no real-aircraft procedures. Confirm every checklist against the current
        approved aircraft material before relying on it.
      </Text>
      {error !== null && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

      {activeRun !== null && (
        <ActiveChecklist
          disabled={saving}
          onAbandon={confirmAbandon}
          onToggle={(sequence) => void toggle(sequence)}
          run={activeRun}
        />
      )}

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Recent terminal runs
      </Text>
      {historyError !== null && (
        <Text style={[styles.error, { color: theme.danger }]}>{historyError}</Text>
      )}
      {history.length === 0 && historyError === null ? (
        <Card>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>No terminal runs.</Text>
        </Card>
      ) : (
        history.map((run) => (
          <View key={run.id} style={[styles.history, { borderColor: theme.separator }]}>
            <Text style={[styles.templateTitle, { color: theme.primary }]}>
              {run.templateSnapshot.title}
            </Text>
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              {run.templateSnapshot.aircraftLabel} · {run.templateSnapshot.category} ·{' '}
              {run.itemCount} items
            </Text>
            <Text style={[styles.historyMeta, { color: theme.secondary }]}>
              {run.abandonedAt === null ? 'COMPLETED' : 'ABANDONED'} ·{' '}
              {run.completedSequences.length}/{run.itemCount} ITEMS · LOCKED SNAPSHOT · REV{' '}
              {run.templateRevision} ·{' '}
              {new Date(run.completedAt ?? run.abandonedAt ?? run.startedAt).toLocaleString()}
            </Text>
          </View>
        ))
      )}

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Saved templates
      </Text>
      {templates.length === 0 ? (
        <Card>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>
            No saved checklists.
          </Text>
        </Card>
      ) : (
        templates.map((template) => (
          <View key={template.id} style={[styles.template, { borderColor: theme.separator }]}>
            <View style={styles.templateCopy}>
              <Text style={[styles.templateTitle, { color: theme.primary }]}>
                {template.title}
              </Text>
              <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                {template.aircraftLabel} · {template.category} · {template.items.length} items ·
                unverified
              </Text>
            </View>
            <Action
              disabled={saving || readBlocked || activeRun?.completedAt === null}
              label="Start"
              onPress={() => void begin(template)}
            />
          </View>
        ))
      )}

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        New user checklist
      </Text>
      <Card>
        <FormField control={control} label="Title" name="title" />
        <Text style={[panelStyles.label, styles.formGap, { color: theme.secondary }]}>
          Aircraft reference
        </Text>
        <View style={styles.aircraftChoices}>
          <Action
            label="Free-text label"
            onPress={() => {
              setSelectedAircraftId(null);
              setValue('aircraftLabel', '');
            }}
            primary={selectedAircraftId === null}
          />
          {aircraft.map((profile) => (
            <Action
              key={profile.id}
              label={`${profile.registration} · ${profile.displayName}`}
              onPress={() => {
                setSelectedAircraftId(profile.id);
                setValue('aircraftLabel', profile.registration);
              }}
              primary={selectedAircraftId === profile.id}
            />
          ))}
        </View>
        {aircraftError !== null && (
          <Text style={[styles.error, { color: theme.attention }]}>{aircraftError}</Text>
        )}
        <View style={styles.formGap}>
          <FormField
            control={control}
            editable={selectedAircraftId === null}
            label={selectedAircraftId === null ? 'Aircraft / source label' : 'Linked aircraft'}
            name="aircraftLabel"
          />
        </View>
        <Text style={[panelStyles.label, styles.formGap, { color: theme.secondary }]}>
          Category
        </Text>
        <View style={styles.categories}>
          {categories.map((value) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: category === value }}
              key={value}
              onPress={() => setCategory(value)}
              style={[
                styles.category,
                {
                  backgroundColor: category === value ? theme.accent : theme.panel,
                  borderColor: category === value ? theme.accent : theme.separator,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  { color: category === value ? theme.onAccent : theme.primary },
                ]}
              >
                {value.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        {category === 'emergency' && (
          <Text style={[styles.emergency, { color: theme.danger }]}>
            Emergency content remains unverified and must not replace approved procedures.
          </Text>
        )}
        {fields.map((field, index) => (
          <View key={field.id} style={[styles.itemEditor, { borderColor: theme.separator }]}>
            <Text style={[panelStyles.label, { color: theme.secondary }]}>
              ITEM {index + 1}
            </Text>
            <FormField control={control} label="Challenge" name={`items.${index}.challenge`} />
            <FormField control={control} label="Response" name={`items.${index}.response`} />
            <View style={styles.criticalRow}>
              <Text style={[panelStyles.copy, { color: theme.primary }]}>Critical item</Text>
              <Controller
                control={control}
                name={`items.${index}.isCritical`}
                render={({ field: { onChange, value } }) => (
                  <Switch
                    accessibilityLabel={`Item ${index + 1} critical`}
                    onValueChange={onChange}
                    value={value}
                  />
                )}
              />
            </View>
            {fields.length > 1 && (
              <Action destructive label="Remove item" onPress={() => remove(index)} />
            )}
          </View>
        ))}
        <View style={styles.formActions}>
          <Action
            disabled={fields.length >= 10}
            label="Add item"
            onPress={() => append({ challenge: '', isCritical: false, response: '' })}
          />
          <Action
            disabled={saving || readBlocked}
            label={saving ? 'Saving…' : 'Save template'}
            onPress={() => void saveTemplate()}
            primary
          />
        </View>
      </Card>
    </ScrollView>
  );
}

function ActiveChecklist({
  disabled,
  onAbandon,
  onToggle,
  run,
}: {
  readonly disabled: boolean;
  readonly onAbandon: () => void;
  readonly onToggle: (sequence: number) => void;
  readonly run: ChecklistRun;
}) {
  const theme = useDriftlineTheme();
  const complete = run.completedAt !== null;
  return (
    <View
      style={[
        styles.active,
        { backgroundColor: theme.panelRaised, borderColor: theme.attention },
      ]}
    >
      <Text style={[styles.activeStatus, { color: complete ? theme.accent : theme.attention }]}>
        {complete ? 'COMPLETE · SNAPSHOT LOCKED' : 'ACTIVE · UNVERIFIED'}
      </Text>
      <Text style={[styles.activeTitle, { color: theme.primary }]}>
        {run.templateSnapshot.title}
      </Text>
      <Text style={[panelStyles.copy, { color: theme.secondary }]}>
        Revision {run.templateRevision} · {run.templateSnapshot.aircraftLabel} ·{' '}
        {run.templateSnapshot.category}
      </Text>
      <View style={styles.runItems}>
        {run.templateSnapshot.items.map((item) => {
          const checked = run.completedSequences.includes(item.sequence);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: disabled || complete }}
              disabled={disabled || complete}
              key={item.sequence}
              onPress={() => onToggle(item.sequence)}
              style={[styles.runItem, { borderColor: theme.separator }]}
            >
              <Text style={[styles.check, { color: checked ? theme.accent : theme.secondary }]}>
                {checked ? '✓' : String(item.sequence + 1)}
              </Text>
              <View style={styles.runCopy}>
                <Text style={[styles.challenge, { color: theme.primary }]}>
                  {item.challenge}
                </Text>
                <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                  {item.response}
                </Text>
              </View>
              {item.isCritical && (
                <Text style={[styles.critical, { color: theme.danger }]}>CRITICAL</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {!complete && (
        <View style={styles.abandonAction}>
          <Action destructive disabled={disabled} label="Abandon run" onPress={onAbandon} />
        </View>
      )}
    </View>
  );
}

function FormField({
  control,
  editable = true,
  label,
  name,
}: {
  readonly control: ReturnType<typeof useForm<ChecklistForm>>['control'];
  readonly editable?: boolean;
  readonly label: string;
  readonly name:
    `items.${number}.challenge` | `items.${number}.response` | 'aircraftLabel' | 'title';
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.formField}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextInput
            accessibilityLabel={label}
            autoCorrect={false}
            editable={editable}
            onBlur={onBlur}
            onChangeText={onChange}
            spellCheck={false}
            style={[
              styles.input,
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

const styles = StyleSheet.create({
  abandonAction: { alignItems: 'flex-start', marginTop: spacing.lg },
  active: {
    borderRadius: radii.panel,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  activeStatus: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activeTitle: {
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  aircraftChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  category: {
    borderRadius: radii.capsule,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  categoryText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800' },
  challenge: { fontFamily: typography.body, fontSize: 15, fontWeight: '700' },
  check: { fontFamily: typography.mono, fontSize: 16, fontWeight: '800', width: 24 },
  critical: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800' },
  criticalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  emergency: {
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  error: { fontFamily: typography.body, fontSize: 13, marginTop: spacing.md },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  formField: { gap: spacing.xs },
  formGap: { marginTop: spacing.md },
  history: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  historyMeta: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.body,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  itemEditor: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  notice: { fontFamily: typography.mono, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  noticeCopy: { marginTop: spacing.xs },
  runCopy: { flex: 1 },
  runItem: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  runItems: { marginTop: spacing.md },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  template: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  templateCopy: { flex: 1 },
  templateTitle: { fontFamily: typography.display, fontSize: 17, fontWeight: '700' },
});
