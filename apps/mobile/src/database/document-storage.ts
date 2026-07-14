import type { DocumentRecord } from '@driftline/aviation-domain';
import { Directory, File, Paths } from 'expo-file-system';

import {
  reconcileDocumentStorageIndex,
  type DocumentStorageAudit,
  type DocumentStorageEntry,
} from '@/domain/document-storage-audit';

const MAX_DOCUMENT_STORAGE_ENTRIES = 1_000;

export const auditDocumentStorage = (
  documents: readonly DocumentRecord[],
): DocumentStorageAudit => {
  const directory = new Directory(Paths.document, 'driftline-documents');
  const listed = directory.exists ? directory.list() : [];
  if (listed.length > MAX_DOCUMENT_STORAGE_ENTRIES) {
    throw new Error('Document storage exceeds the supported audit limit');
  }
  const entries: DocumentStorageEntry[] = listed.map((entry) => {
    if (entry instanceof File) {
      return {
        byteLength: Number.isSafeInteger(entry.size) && entry.size >= 0 ? entry.size : null,
        kind: 'file',
        uri: entry.uri,
      };
    }
    return { byteLength: null, kind: 'directory', uri: entry.uri };
  });
  return reconcileDocumentStorageIndex(
    documents.map((document) => ({
      byteLength: document.byteLength,
      expectedUri: new File(directory, `${document.id}.pdf`).uri,
      id: document.id,
      recordedUri: document.localUri,
    })),
    entries,
  );
};
