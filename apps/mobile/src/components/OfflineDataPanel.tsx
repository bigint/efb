import { spacing, typography } from '@driftline/design-system';
import { Paths } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  readOfflineRegistry,
  type OfflineRegistrySnapshot,
} from '@/database/offline-registry-repository';
import { decodeStorageCapacity, type StorageCapacity } from '@/domain/storage-capacity';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, panelStyles } from './PanelPrimitives';

const formatBytes = (bytes: number): string => {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return 'INVALID';
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_024 * 1_024 * 1_024) return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
  return `${(bytes / (1_024 * 1_024 * 1_024)).toFixed(1)} GB`;
};

export function OfflineDataPanel() {
  const theme = useDriftlineTheme();
  const [snapshot, setSnapshot] = useState<OfflineRegistrySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState<StorageCapacity | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setStorage(decodeStorageCapacity(Paths.totalDiskSpace, Paths.availableDiskSpace));
      setStorageError(null);
    } catch {
      setStorage(null);
      setStorageError('Device storage capacity unavailable.');
    }
    try {
      setSnapshot(await readOfflineRegistry());
      setError(null);
    } catch {
      setSnapshot(null);
      setError('Offline registry unavailable: stored metadata did not pass integrity checks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <>
      <Text style={[panelStyles.sectionTitle, styles.section, { color: theme.primary }]}>
        Offline data manager
      </Text>
      <Card>
        <Text style={[styles.notice, { color: theme.attention }]}>
          REGISTRY METADATA ONLY · FILESYSTEM NOT REVERIFIED
        </Text>
        <Text style={[panelStyles.copy, styles.copy, { color: theme.secondary }]}>
          Signed-package download and atomic filesystem activation are not connected. This view
          reports only generations that already passed the local registry boundary.
        </Text>
        <View style={[styles.capacity, { borderColor: theme.separator }]}>
          <Text style={[panelStyles.label, { color: theme.secondary }]}>DEVICE STORAGE</Text>
          {storage === null ? (
            <Text style={[panelStyles.copy, { color: theme.attention }]}>
              {storageError ?? 'Capacity unavailable.'}
            </Text>
          ) : (
            <>
              <Text style={[styles.capacityValue, { color: theme.primary }]}>
                {formatBytes(storage.availableBytes)} AVAILABLE /{' '}
                {formatBytes(storage.totalBytes)}
              </Text>
              <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                {storage.usedPercent.toFixed(1)}% device storage used · not reserved for
                Driftline
              </Text>
            </>
          )}
        </View>
        {loading ? (
          <Text style={[panelStyles.copy, styles.state, { color: theme.secondary }]}>
            Reading local control database…
          </Text>
        ) : error !== null ? (
          <View style={styles.state}>
            <Text style={[panelStyles.copy, { color: theme.danger }]}>{error}</Text>
            <View style={styles.action}>
              <Action label="Retry registry" onPress={() => void reload()} />
            </View>
          </View>
        ) : snapshot !== null ? (
          <View style={styles.state}>
            <RegistrySummary snapshot={snapshot} />
            <View style={styles.action}>
              <Action label="Refresh registry" onPress={() => void reload()} />
            </View>
          </View>
        ) : null}
      </Card>
    </>
  );
}

function RegistrySummary({ snapshot }: { readonly snapshot: OfflineRegistrySnapshot }) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.registry}>
      <Text style={[styles.count, { color: theme.primary }]}>
        {snapshot.activePackages.length} ACTIVE PACKAGE
        {snapshot.activePackages.length === 1 ? '' : 'S'}
      </Text>
      {snapshot.activePackages.length === 0 ? (
        <Text style={[panelStyles.copy, { color: theme.secondary }]}>
          No verified offline region is active. Demo airports and the graticule are bundled app
          fixtures, not an offline aviation dataset.
        </Text>
      ) : (
        snapshot.activePackages.map((item) => (
          <View key={item.datasetId} style={[styles.row, { borderColor: theme.separator }]}>
            <Text style={[styles.rowTitle, { color: theme.primary }]}>
              {item.regionId} · {item.jurisdiction}
            </Text>
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              Sequence {item.sequence} · {item.availability} · {item.fileCount} files ·{' '}
              {formatBytes(item.totalBytes)}
            </Text>
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              {item.source} · {item.sourceVersion} · expires {item.expiresAt}
            </Text>
          </View>
        ))
      )}
      <Text style={[styles.attempts, { color: theme.secondary }]}>
        {snapshot.attempts.length} RECENT TRANSFER ATTEMPT
        {snapshot.attempts.length === 1 ? '' : 'S'} RECORDED
      </Text>
      {snapshot.attempts.slice(0, 3).map((attempt) => (
        <View key={attempt.attemptId} style={[styles.row, { borderColor: theme.separator }]}>
          <Text style={[styles.rowTitle, { color: theme.primary }]}>
            {attempt.regionId} · {attempt.status.toUpperCase()}
          </Text>
          <Text style={[panelStyles.copy, { color: theme.secondary }]}>
            {formatBytes(attempt.receivedBytes)} / {formatBytes(attempt.expectedBytes)} ·{' '}
            {Math.floor((attempt.receivedBytes / attempt.expectedBytes) * 100)}%
          </Text>
          {attempt.failureCode !== null && (
            <Text style={[panelStyles.copy, { color: theme.danger }]}>
              Failure: {attempt.failureCode}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'flex-start', marginTop: spacing.md },
  attempts: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: spacing.md,
  },
  copy: { marginTop: spacing.sm },
  capacity: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  capacityValue: { fontFamily: typography.mono, fontSize: 13, fontWeight: '800' },
  count: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800' },
  notice: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  registry: { gap: spacing.sm },
  row: { borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingTop: spacing.md },
  rowTitle: { fontFamily: typography.body, fontSize: 14, fontWeight: '700' },
  section: { marginTop: spacing.xl },
  state: { marginTop: spacing.lg },
});
