import {
  documentRecordSchema,
  documentIdSchema,
  hasPdfContainerMarkers,
  MAX_IMPORTED_PDF_BYTES,
  type DocumentRecord,
} from '@driftline/aviation-domain';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { insertDocument } from './document-repository';
import { sha256Bytes } from './document-crypto';

const removeFileBestEffort = (file: File): void => {
  try {
    file.delete();
  } catch {
    // A startup reconciliation pass must remove any orphan retained by the platform.
  }
};

export const pickAndImportPdf = async (
  database: SQLiteDatabase,
  id: string,
): Promise<DocumentRecord | null> => {
  const documentId = documentIdSchema.parse(id);
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: 'application/pdf',
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (asset === undefined) throw new Error('Document picker returned no file');
  if (asset.mimeType !== undefined && asset.mimeType.toLowerCase() !== 'application/pdf') {
    throw new Error('Only PDF documents can be imported');
  }
  if (asset.size !== undefined && asset.size > MAX_IMPORTED_PDF_BYTES) {
    throw new Error('PDF exceeds the 25 MB import limit');
  }

  const source = new File(asset.uri);
  if (
    !Number.isSafeInteger(source.size) ||
    source.size <= 0 ||
    source.size > MAX_IMPORTED_PDF_BYTES
  ) {
    throw new Error('PDF size is unavailable or exceeds the 25 MB import limit');
  }
  const bytes = await source.bytes();
  if (bytes.length !== source.size) throw new Error('PDF changed while it was being imported');
  if (!hasPdfContainerMarkers(bytes))
    throw new Error('Selected file is not a complete PDF container');
  const sourceDigest = await sha256Bytes(bytes);

  const directory = new Directory(Paths.document, 'driftline-documents');
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${documentId}.pdf`);
  if (destination.exists) throw new Error('Document destination already exists');
  try {
    await source.copy(destination);
    const storedBytes = await destination.bytes();
    if (
      storedBytes.length !== bytes.length ||
      (await sha256Bytes(storedBytes)) !== sourceDigest
    ) {
      throw new Error('Stored PDF failed post-copy integrity verification');
    }
    const importedAt = new Date().toISOString();
    const document = documentRecordSchema.parse({
      bookmarks: [],
      byteLength: bytes.length,
      deletedAt: null,
      displayName: asset.name,
      folder: 'Unfiled',
      id: documentId,
      importedAt,
      isFavourite: false,
      lastOpenedAt: null,
      localUri: destination.uri,
      mimeType: 'application/pdf',
      pageCount: null,
      sha256: sourceDigest,
      source: 'user-imported',
      storageScope: 'app-private',
      textIndexStatus: 'unavailable',
    });
    await insertDocument(database, document);
    return document;
  } catch (error) {
    removeFileBestEffort(destination);
    throw error;
  }
};
