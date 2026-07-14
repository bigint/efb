import type { DocumentRecord } from '@driftline/aviation-domain';
import { spacing, typography } from '@driftline/design-system';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { pickAndImportPdf } from '@/database/document-import';
import {
  insertDocumentBookmark,
  listDocuments,
  setDocumentFavourite,
  setDocumentFolder,
} from '@/database/document-repository';
import { auditDocumentStorage } from '@/database/document-storage';
import { shareVerifiedDocumentPdf } from '@/database/document-share';
import type { DocumentStorageAudit } from '@/domain/document-storage-audit';
import { useDriftlineTheme } from '@/theme';

import { Action, Card, panelStyles } from './PanelPrimitives';

export function DocumentsPanel() {
  const database = useSQLiteContext();
  const theme = useDriftlineTheme();
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<readonly DocumentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [storageAudit, setStorageAudit] = useState<DocumentStorageAudit | null>(null);
  const [storageAuditError, setStorageAuditError] = useState<string | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{
    readonly documentId: string;
    readonly isError: boolean;
    readonly text: string;
  } | null>(null);
  const [folder, setFolder] = useState('');
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [bookmarkPage, setBookmarkPage] = useState('');

  const reload = useCallback(async () => {
    try {
      const storedDocuments = await listDocuments(database);
      setDocuments(storedDocuments);
      setError(null);
      setReadBlocked(false);
      try {
        setStorageAudit(auditDocumentStorage(storedDocuments));
        setStorageAuditError(null);
      } catch {
        setStorageAudit(null);
        setStorageAuditError('Private document storage could not be audited on this device.');
      }
    } catch {
      setDocuments([]);
      setStorageAudit(null);
      setStorageAuditError(null);
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

  const toggleFavourite = async (document: DocumentRecord) => {
    setBusy(true);
    try {
      await setDocumentFavourite(database, document, !document.isFavourite);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update favourite.');
    } finally {
      setBusy(false);
    }
  };

  const saveFolder = async (document: DocumentRecord) => {
    setBusy(true);
    try {
      await setDocumentFolder(database, document, folder);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update folder.');
    } finally {
      setBusy(false);
    }
  };

  const addBookmark = async (document: DocumentRecord) => {
    setBusy(true);
    try {
      if (!/^\d{1,5}$/u.test(bookmarkPage)) throw new Error('Page must be a whole number.');
      const pageNumber = Number(bookmarkPage);
      if (pageNumber < 1) throw new Error('Page numbering starts at 1.');
      await insertDocumentBookmark(
        database,
        document,
        pageNumber - 1,
        bookmarkLabel,
        new Date().toISOString(),
      );
      setBookmarkLabel('');
      setBookmarkPage('');
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add bookmark.');
    } finally {
      setBusy(false);
    }
  };

  const toggleOrganizer = (document: DocumentRecord) => {
    if (selectedDocumentId === document.id) {
      setSelectedDocumentId(null);
      return;
    }
    setSelectedDocumentId(document.id);
    setFolder(document.folder);
    setBookmarkLabel('');
    setBookmarkPage('');
  };

  const shareDocument = async (document: DocumentRecord) => {
    setBusy(true);
    setShareStatus(null);
    try {
      const result = await shareVerifiedDocumentPdf(document);
      setShareStatus({
        documentId: document.id,
        isError: result.kind === 'sharing-unavailable',
        text:
          result.kind === 'share-sheet-closed'
            ? 'Share sheet closed after full file verification. Confirm the destination separately.'
            : 'Native sharing is unavailable on this device.',
      });
    } catch (caught) {
      setShareStatus({
        documentId: document.id,
        isError: true,
        text:
          caught instanceof Error
            ? caught.message
            : 'The stored PDF could not be verified for sharing.',
      });
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
            label={busy ? 'Working…' : 'Import PDF'}
            onPress={() => void importPdf()}
            primary
          />
        </View>
        {error !== null && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
        {storageAudit !== null && (
          <View style={styles.audit}>
            <Text
              accessibilityRole={storageAudit.status === 'attention' ? 'alert' : undefined}
              style={[
                styles.status,
                { color: storageAudit.status === 'healthy' ? theme.accent : theme.danger },
              ]}
            >
              {storageAudit.status === 'healthy'
                ? `STORAGE INDEX CONSISTENT · ${storageAudit.checkedDocuments} RECORDS`
                : `STORAGE ATTENTION · ${storageAudit.missingDocumentIds.length} MISSING · ${storageAudit.sizeMismatchDocumentIds.length} SIZE CHANGED · ${storageAudit.unexpectedLocationDocumentIds.length} MISPLACED · ${storageAudit.orphanEntryCount} UNREGISTERED`}
            </Text>
            <Text style={[panelStyles.copy, { color: theme.secondary }]}>
              Non-destructive location and byte-length audit only. Stored SHA-256 digests are
              not rehashed during library load.
            </Text>
          </View>
        )}
        {storageAuditError !== null && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {storageAuditError}
          </Text>
        )}
      </Card>
      {documents.map((document) => (
        <View key={document.id} style={[styles.document, { borderColor: theme.separator }]}>
          <View style={styles.documentHeading}>
            <View style={styles.documentCopy}>
              <Text style={[styles.name, { color: theme.primary }]}>
                {document.isFavourite ? '★ ' : ''}
                {document.displayName}
              </Text>
              <Text style={[panelStyles.copy, { color: theme.secondary }]}>
                {(document.byteLength / 1_000_000).toFixed(1)} MB · {document.folder} ·{' '}
                {document.sha256.slice(0, 10)}…
              </Text>
            </View>
            <Text style={[styles.readerState, { color: theme.secondary }]}>
              READER NOT VERIFIED
            </Text>
          </View>
          <View style={styles.rowActions}>
            <Action
              disabled={busy || readBlocked}
              label={document.isFavourite ? 'Unfavourite' : 'Favourite'}
              onPress={() => void toggleFavourite(document)}
            />
            <Action
              disabled={busy || readBlocked}
              label={selectedDocumentId === document.id ? 'Close organizer' : 'Organize'}
              onPress={() => toggleOrganizer(document)}
            />
            <Action
              disabled={busy || readBlocked}
              label="Share verified copy"
              onPress={() => void shareDocument(document)}
            />
          </View>
          {shareStatus?.documentId === document.id && (
            <Text
              accessibilityRole="alert"
              style={[
                styles.error,
                { color: shareStatus.isError ? theme.danger : theme.secondary },
              ]}
            >
              {shareStatus.text}
            </Text>
          )}
          {selectedDocumentId === document.id && (
            <View style={[styles.organizer, { backgroundColor: theme.panelRaised }]}>
              <Text style={[styles.status, { color: theme.attention }]}>
                METADATA ONLY · READER REMAINS DISABLED
              </Text>
              <View style={styles.editorRow}>
                <MetadataInput label="Folder" onChange={setFolder} value={folder} />
                <Action
                  disabled={busy || readBlocked}
                  label="Save folder"
                  onPress={() => void saveFolder(document)}
                />
              </View>
              <View style={styles.editorRow}>
                <MetadataInput
                  label="Bookmark page · 1-based"
                  numeric
                  onChange={setBookmarkPage}
                  value={bookmarkPage}
                />
                <MetadataInput
                  label="Bookmark label"
                  onChange={setBookmarkLabel}
                  value={bookmarkLabel}
                />
                <Action
                  disabled={busy || readBlocked}
                  label="Add bookmark"
                  onPress={() => void addBookmark(document)}
                />
              </View>
              {document.bookmarks.map((bookmark) => (
                <Text
                  key={`${bookmark.pageIndex}-${bookmark.label}`}
                  style={[panelStyles.copy, { color: theme.secondary }]}
                >
                  Page {bookmark.pageIndex + 1} · {bookmark.label}
                </Text>
              ))}
            </View>
          )}
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

function MetadataInput({
  label,
  numeric = false,
  onChange,
  value,
}: {
  readonly label: string;
  readonly numeric?: boolean;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.metadataField}>
      <Text style={[panelStyles.label, { color: theme.secondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        keyboardType={numeric ? 'number-pad' : 'default'}
        onChangeText={onChange}
        style={[
          styles.metadataInput,
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

const styles = StyleSheet.create({
  action: { alignItems: 'flex-start', marginTop: spacing.md },
  audit: { gap: spacing.xs, marginTop: spacing.md },
  copy: { marginTop: spacing.xs },
  document: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  documentCopy: { flex: 1 },
  documentHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  editorRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  empty: { marginTop: spacing.md },
  error: { fontFamily: typography.body, fontSize: 13, marginTop: spacing.md },
  metadataField: { flex: 1, gap: spacing.xs, minWidth: 160 },
  metadataInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: typography.mono,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  name: { fontFamily: typography.display, fontSize: 17, fontWeight: '700' },
  organizer: { borderRadius: 10, gap: spacing.md, padding: spacing.md },
  readerState: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  status: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});
