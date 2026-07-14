import { radii, spacing, typography } from '@driftline/design-system';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  demoAirports,
  resolveSavedFlightPlan,
  reviseSavedFlightPlan,
  savedFlightPlanSchema,
  type SavedFlightPlan,
} from '@driftline/aviation-domain';
import { knots, trueDegrees } from '@driftline/data-contracts';
import {
  calculateRoute,
  calculateWindAdjustedRoute,
  resolveRouteIdentifiers,
} from '@driftline/flight-planning';

import {
  insertSavedFlightPlan,
  listSavedFlightPlans,
  replaceSavedFlightPlan,
} from '@/database/flight-plan-repository';
import { useFlightStore } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, PanelHeader, panelStyles } from './PanelPrimitives';

export function PlanWorkspace() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [savedPlans, setSavedPlans] = useState<readonly SavedFlightPlan[]>([]);
  const [saveTitle, setSaveTitle] = useState('');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trueAirspeed, setTrueAirspeed] = useState('118');
  const [windFromTrue, setWindFromTrue] = useState('0');
  const [windSpeed, setWindSpeed] = useState('0');
  const addWaypoint = useFlightStore((state) => state.addWaypoint);
  const clearRoute = useFlightStore((state) => state.clearRoute);
  const removeWaypoint = useFlightStore((state) => state.removeWaypoint);
  const replaceRoute = useFlightStore((state) => state.replaceRoute);
  const reverseRoute = useFlightStore((state) => state.reverseRoute);
  const routeIdentifiers = useFlightStore((state) => state.routeIdentifiers);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);
  const routeResolution = resolveRouteIdentifiers(
    routeIdentifiers,
    demoAirports.map((airport) => ({ identifier: airport.icao, position: airport.position })),
  );
  const airports =
    routeResolution.status === 'resolved'
      ? routeResolution.waypoints.map((waypoint) => {
          const airport = demoAirports.find(({ icao }) => icao === waypoint.identifier);
          if (airport === undefined) throw new Error('Resolved airport invariant failed');
          return airport;
        })
      : [];
  const summary = calculateRoute(
    airports.map((airport) => ({ identifier: airport.icao, position: airport.position })),
    null,
  );
  const assumptionValues = [trueAirspeed, windFromTrue, windSpeed].map((value) =>
    value.trim().length === 0 ? Number.NaN : Number(value),
  );
  const assumptionsValid =
    assumptionValues.every(Number.isFinite) &&
    (assumptionValues[0] ?? 0) > 0 &&
    (assumptionValues[1] ?? -1) >= 0 &&
    (assumptionValues[1] ?? 360) < 360 &&
    (assumptionValues[2] ?? -1) >= 0;
  const windAdjusted = assumptionsValid
    ? calculateWindAdjustedRoute({
        trueAirspeed: knots(assumptionValues[0] ?? Number.NaN),
        waypoints: airports.map((airport) => ({
          identifier: airport.icao,
          position: airport.position,
        })),
        windFromTrue: trueDegrees(assumptionValues[1] ?? Number.NaN),
        windSpeed: knots(assumptionValues[2] ?? Number.NaN),
      })
    : null;

  const reloadSavedPlans = useCallback(async () => {
    try {
      setSavedPlans(await listSavedFlightPlans(database));
      setPersistenceError(null);
      setReadBlocked(false);
      return true;
    } catch {
      setSavedPlans([]);
      setPersistenceError('Saved flights unavailable: stored routes failed integrity checks.');
      setReadBlocked(true);
      return false;
    }
  }, [database]);

  useEffect(() => {
    void reloadSavedPlans();
  }, [reloadSavedPlans]);

  const saveRoute = async () => {
    setSaving(true);
    try {
      if (routeResolution.status !== 'resolved' || airports.length < 2) {
        throw new Error('A saved flight requires at least two resolved waypoints.');
      }
      const now = new Date().toISOString();
      const plan = savedFlightPlanSchema.parse({
        aircraftId: null,
        altitudeFeet: null,
        createdAt: now,
        departureTime: null,
        id: randomUUID(),
        notes: '',
        revision: 1,
        status: 'draft',
        title: saveTitle,
        updatedAt: now,
        waypoints: airports.map((airport, sequence) => ({
          identifier: airport.icao,
          latitude: airport.position.latitude,
          longitude: airport.position.longitude,
          sequence,
          sourceRef: `${airport.provenance.datasetVersion}:${airport.icao}`,
        })),
      });
      await insertSavedFlightPlan(database, plan);
      setSaveTitle('');
      await reloadSavedPlans();
    } catch (caught) {
      setPersistenceError(caught instanceof Error ? caught.message : 'Unable to save flight.');
    } finally {
      setSaving(false);
    }
  };

  const revisePlan = async (
    plan: SavedFlightPlan,
    changes: Parameters<typeof reviseSavedFlightPlan>[1],
  ) => {
    setSaving(true);
    try {
      const next = reviseSavedFlightPlan(plan, changes, new Date().toISOString());
      await replaceSavedFlightPlan(database, plan.revision, next);
      setEditingPlanId(null);
      setEditingTitle('');
      await reloadSavedPlans();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to revise flight.';
      if (await reloadSavedPlans()) setPersistenceError(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = (plan: SavedFlightPlan) => {
    Alert.alert(
      'Archive saved flight?',
      `${plan.title} will leave the active saved-flight list. Its record is retained locally.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void revisePlan(plan, { status: 'archived' }),
          style: 'destructive',
          text: 'Archive',
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      style={[panelStyles.body, { backgroundColor: theme.background }]}
    >
      <PanelHeader eyebrow="DRAFT ROUTE · DEMONSTRATION" title="Plan" />
      <Card>
        <View style={styles.summary}>
          <Summary
            label="Distance"
            value={
              summary.status === 'ready'
                ? `${summary.totalDistance?.toFixed(1) ?? '—'} NM`
                : '—'
            }
          />
          <Summary
            label="ETE · demo wind"
            value={
              windAdjusted === null
                ? 'INVALID'
                : windAdjusted.status === 'ready'
                  ? `${windAdjusted.estimatedMinutes.toFixed(0)} MIN`
                  : windAdjusted.status === 'no-solution'
                    ? 'NO SOLUTION'
                    : '—'
            }
          />
          <Summary label="Legs" value={String(summary.legs.length)} />
          <Summary
            label="State"
            value={
              routeResolution.status === 'unresolved'
                ? 'BLOCKED'
                : windAdjusted === null
                  ? 'INVALID ASSUMPTIONS'
                  : windAdjusted.status === 'no-solution'
                    ? 'BLOCKED'
                    : summary.status.toUpperCase()
            }
          />
        </View>
      </Card>

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Saved offline
      </Text>
      <Card>
        <Text style={[styles.assumptionWarning, { color: theme.attention }]}>
          USER DRAFT · FICTIONAL DEMONSTRATION WAYPOINTS
        </Text>
        <View style={styles.saveRow}>
          <TextInput
            accessibilityLabel="Saved flight title"
            onChangeText={setSaveTitle}
            placeholder="Flight title"
            placeholderTextColor={theme.secondary}
            style={[
              styles.input,
              styles.titleInput,
              {
                backgroundColor: theme.background,
                borderColor: theme.separator,
                color: theme.primary,
              },
            ]}
            value={saveTitle}
          />
          <Action
            disabled={
              saving ||
              readBlocked ||
              routeResolution.status !== 'resolved' ||
              airports.length < 2
            }
            label={saving ? 'Saving…' : 'Save draft'}
            onPress={() => void saveRoute()}
            primary
          />
        </View>
        {persistenceError !== null && (
          <View>
            <Text
              accessibilityRole="alert"
              style={[styles.inputError, { color: theme.danger }]}
            >
              {persistenceError}
            </Text>
            {readBlocked && (
              <View style={styles.retry}>
                <Action label="Retry saved flights" onPress={() => void reloadSavedPlans()} />
              </View>
            )}
          </View>
        )}
        <View style={styles.savedList}>
          {savedPlans.length === 0 ? (
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              No saved flights.
            </Text>
          ) : (
            savedPlans.map((plan) => {
              const resolution = resolveSavedFlightPlan(
                plan,
                demoAirports.map((airport) => ({
                  identifier: airport.icao,
                  latitude: airport.position.latitude,
                  longitude: airport.position.longitude,
                  sourceRef: `${airport.provenance.datasetVersion}:${airport.icao}`,
                })),
              );
              return (
                <View
                  key={plan.id}
                  style={[styles.savedPlan, { borderColor: theme.separator }]}
                >
                  <View style={styles.routeCopy}>
                    <Text style={[styles.identifier, { color: theme.primary }]}>
                      {plan.title}
                    </Text>
                    <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                      {plan.waypoints.map(({ identifier }) => identifier).join(' → ')} ·
                      revision {plan.revision}
                    </Text>
                    {resolution.status === 'dataset-mismatch' && (
                      <Text style={[panelStyles.copy, { color: theme.danger }]}>
                        Load blocked: active data differs for{' '}
                        {resolution.mismatchedIdentifiers.join(', ')}.
                      </Text>
                    )}
                  </View>
                  <View style={styles.savedActions}>
                    <Action
                      disabled={resolution.status !== 'ready'}
                      label="Load draft"
                      onPress={() => {
                        if (resolution.status === 'ready') replaceRoute(resolution.identifiers);
                      }}
                    />
                    <Action
                      disabled={saving}
                      label="Rename"
                      onPress={() => {
                        setEditingPlanId(plan.id);
                        setEditingTitle(plan.title);
                      }}
                    />
                    <Action
                      destructive
                      disabled={saving}
                      label="Archive"
                      onPress={() => confirmArchive(plan)}
                    />
                  </View>
                  {editingPlanId === plan.id && (
                    <View style={styles.renameEditor}>
                      <TextInput
                        accessibilityLabel={`New title for ${plan.title}`}
                        autoFocus
                        maxLength={120}
                        onChangeText={setEditingTitle}
                        style={[
                          styles.input,
                          styles.renameInput,
                          {
                            backgroundColor: theme.background,
                            borderColor: theme.separator,
                            color: theme.primary,
                          },
                        ]}
                        value={editingTitle}
                      />
                      <View style={styles.savedActions}>
                        <Action
                          disabled={saving || editingTitle.trim().length === 0}
                          label="Save title"
                          onPress={() => void revisePlan(plan, { title: editingTitle })}
                          primary
                        />
                        <Action
                          disabled={saving}
                          label="Cancel"
                          onPress={() => {
                            setEditingPlanId(null);
                            setEditingTitle('');
                          }}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </Card>

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Planning assumptions
      </Text>
      <Card>
        <Text style={[styles.assumptionWarning, { color: theme.attention }]}>
          CONSTANT DEMONSTRATION WIND · TRUE REFERENCE
        </Text>
        <View style={styles.inputs}>
          <PlanningInput
            label="True airspeed · KT"
            onChange={setTrueAirspeed}
            value={trueAirspeed}
          />
          <PlanningInput
            label="Wind from · °T"
            onChange={setWindFromTrue}
            value={windFromTrue}
          />
          <PlanningInput label="Wind speed · KT" onChange={setWindSpeed} value={windSpeed} />
        </View>
        <Text style={[panelStyles.copy, styles.assumptionCopy, { color: theme.secondary }]}>
          One manually entered wind is applied to every leg. No winds-aloft source, altitude,
          valid time, interpolation, climb, or descent model is configured.
        </Text>
        {!assumptionsValid && (
          <Text accessibilityRole="alert" style={[styles.inputError, { color: theme.danger }]}>
            Enter TAS above 0 KT, wind direction from 0–359°T, and wind speed at or above 0 KT.
          </Text>
        )}
      </Card>

      {windAdjusted?.status === 'no-solution' && (
        <Card>
          <Text style={[styles.blocked, { color: theme.danger }]}>WIND SOLUTION BLOCKED</Text>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>
            {windAdjusted.failedLeg.from.identifier} → {windAdjusted.failedLeg.to.identifier}:{' '}
            {windAdjusted.reason.replaceAll('-', ' ')}.
          </Text>
        </Card>
      )}

      {windAdjusted?.status === 'ready' && (
        <View style={styles.legSolutions}>
          {windAdjusted.legs.map((leg) => (
            <Card key={`${leg.from.identifier}-${leg.to.identifier}`}>
              <Text style={[styles.legTitle, { color: theme.primary }]}>
                {leg.from.identifier} → {leg.to.identifier}
              </Text>
              <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                CRS {leg.initialTrueCourse.toFixed(0).padStart(3, '0')}°T · HDG{' '}
                {leg.wind.headingTrue.toFixed(0).padStart(3, '0')}°T · GS{' '}
                {leg.wind.groundspeed.toFixed(0)} KT · WCA {leg.wind.windCorrection.toFixed(1)}°
              </Text>
            </Card>
          ))}
        </View>
      )}

      {routeResolution.status === 'unresolved' && (
        <Card>
          <Text style={[styles.blocked, { color: theme.danger }]}>
            ROUTE CALCULATION BLOCKED
          </Text>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>
            The active dataset cannot resolve:{' '}
            {routeResolution.unresolvedIdentifiers.join(', ')}. Remove or replace every
            unresolved waypoint before using route results.
          </Text>
        </Card>
      )}

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Route sequence
      </Text>
      <View style={styles.routeList}>
        {routeIdentifiers.length === 0 && (
          <Card>
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              No route yet. Add a demonstration airport below.
            </Text>
          </Card>
        )}
        {routeIdentifiers.map((identifier, index) => {
          const airport = demoAirports.find(({ icao }) => icao === identifier);
          return (
            <Card key={`${identifier}-${index}`}>
              <View style={panelStyles.row}>
                <Text style={[styles.sequence, { color: theme.accent }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View style={styles.routeCopy}>
                  <Text style={[styles.identifier, { color: theme.primary }]}>
                    {identifier}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[panelStyles.copy, { color: theme.secondary }]}
                  >
                    {airport?.name ?? 'Unresolved in active demonstration dataset'}
                  </Text>
                </View>
                <Action label="Remove" onPress={() => removeWaypoint(identifier)} />
              </View>
            </Card>
          );
        })}
      </View>

      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Add waypoint
      </Text>
      <View style={styles.actions}>
        {demoAirports
          .filter(({ icao }) => !routeIdentifiers.includes(icao))
          .map((airport) => (
            <Action
              key={airport.icao}
              label={`+ ${airport.icao}`}
              onPress={() => addWaypoint(airport.icao)}
            />
          ))}
      </View>
      <View style={styles.actions}>
        <Action label="Reverse route" onPress={reverseRoute} />
        <Action destructive label="Clear route" onPress={clearRoute} />
        <Action primary label="View on map" onPress={() => setWorkspace('map')} />
      </View>
      <Text style={[styles.disclaimer, { color: theme.attention }]}>
        Calculated on a spherical Earth model with fictional demonstration airports. Do not use
        for navigation.
      </Text>
    </ScrollView>
  );
}

function PlanningInput({
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
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onChangeText={onChange}
        selectTextOnFocus
        style={[
          styles.input,
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

function Summary({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.summaryItem}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: theme.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  assumptionCopy: { marginTop: spacing.md },
  assumptionWarning: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  blocked: { fontFamily: 'Menlo', fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  disclaimer: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
  identifier: { fontFamily: 'Menlo', fontSize: 16, fontWeight: '800' },
  input: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.mono,
    fontSize: 17,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inputGroup: { flex: 1, gap: spacing.xs, minWidth: 150 },
  inputError: {
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  legSolutions: { gap: spacing.sm, marginTop: spacing.md },
  legTitle: { fontFamily: typography.mono, fontSize: 14, fontWeight: '800' },
  routeCopy: { flex: 1 },
  routeList: { gap: spacing.sm },
  retry: { alignItems: 'flex-start', marginTop: spacing.sm },
  renameEditor: { gap: spacing.sm, width: '100%' },
  renameInput: { minWidth: 220 },
  saveRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  savedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  savedList: { gap: spacing.sm, marginTop: spacing.lg },
  savedPlan: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  scroll: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  sequence: { fontFamily: 'Menlo', fontSize: 11, fontWeight: '800' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  summaryItem: { minWidth: 110 },
  summaryValue: { fontFamily: 'Menlo', fontSize: 20, fontWeight: '700', marginTop: 5 },
  titleInput: { flex: 1, minWidth: 220 },
});
