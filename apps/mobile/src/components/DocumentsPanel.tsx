import type { DocumentRecord } from '@driftline/aviation-domain';
import { spacing, typography } from '@driftline/design-system';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { pickAndImportPdf } from '@/database/document-import';
import { listDocuments } from '@/database/document-repository';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, panelStyles } from './PanelPrimitives';

export function DocumentsPanel() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<readonly DocumentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);

  const reload = useCallback(async () => {
    try {
      setDocuments(await listDocuments(database));
      setError(null);
      setReadBlocked(false);
    } catch {
      setDocuments([]);
      setError('Document library unavailable: stored metadata did not pass integrity checks.');
      setReadBlocked(true);
    }
  }, [database]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const importPdf = async () => {
    setBusy(true);
    try {
      const imported = await pickAndImportPdf(database, randomUUID());
      if (imported !== null) await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to import PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={[panelStyles.sectionTitle, { color: theme.primary }]}>Documents</Text>
      <Card>
        <Text style={[styles.status, { color: theme.attention }]}>
          PDF ONLY · APP-PRIVATE COPY
        </Text>
        <Text style={[panelStyles.copy, styles.copy, { color: theme.secondary }]}>
          Imports are capped at 25 MB, checked for PDF container markers, copied into app
          storage, and SHA-256 verified after the copy.
        </Text>
        <View style={styles.action}>
          <Action
            disabled={busy || readBlocked}
            label={busy ? 'Importing…' : 'Import PDF'}
            onPress={() => void importPdf()}
            primary
          />
        </View>
        {error !== null && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      </Card>
      {documents.map((document) => (
        <View key={document.id} style={[styles.document, { borderColor: theme.separator }]}>
          <View style={styles.documentCopy}>
            <Text style={[styles.name, { color: theme.primary }]}>{document.displayName}</Text>
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              {(document.byteLength / 1_000_000).toFixed(1)} MB · {document.folder} ·{' '}
              {document.sha256.slice(0, 10)}…
            </Text>
          </View>
          <Text style={[styles.readerState, { color: theme.secondary }]}>
            READER NOT VERIFIED
          </Text>
        </View>
      ))}
      {documents.length === 0 && error === null && (
        <Text style={[panelStyles.copy, styles.empty, { color: theme.secondary }]}>
          No imported documents. Native PDF rendering remains disabled until its offline,
          accessibility, and malformed-file behavior is verified.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'flex-start', marginTop: spacing.md },
  copy: { marginTop: spacing.xs },
  document: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  documentCopy: { flex: 1 },
  empty: { marginTop: spacing.md },
  error: { fontFamily: typography.body, fontSize: 13, marginTop: spacing.md },
  name: { fontFamily: typography.display, fontSize: 17, fontWeight: '700' },
  readerState: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800' },
  status: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});
