import {
  documentRecordSchema,
  hasPdfContainerMarkers,
  type DocumentRecord,
} from '@driftline/aviation-domain';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { validateDocumentShareEvidence } from '@/domain/document-share-boundary';

import { sha256Bytes } from './document-crypto';

export type DocumentShareResult =
  { readonly kind: 'share-sheet-closed' } | { readonly kind: 'sharing-unavailable' };

export const shareVerifiedDocumentPdf = async (
  source: DocumentRecord,
): Promise<DocumentShareResult> => {
  const document = documentRecordSchema.parse(source);
  const directory = new Directory(Paths.document, 'driftline-documents');
  const file = new File(directory, `${document.id}.pdf`);
  if (!file.exists || !Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new Error('Stored PDF is missing or its byte length is unavailable.');
  }
  const bytes = await file.bytes();
  if (bytes.length !== file.size) throw new Error('Stored PDF changed during verification.');
  validateDocumentShareEvidence(document, {
    byteLength: bytes.length,
    expectedUri: file.uri,
    hasPdfContainerMarkers: hasPdfContainerMarkers(bytes),
    sha256: await sha256Bytes(bytes),
  });
  if (!(await Sharing.isAvailableAsync())) return { kind: 'sharing-unavailable' };
  await Sharing.shareAsync(file.uri, {
    dialogTitle: `Share verified copy of ${document.displayName}`,
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
  return { kind: 'share-sheet-closed' };
};
