import { documentRecordSchema, type DocumentRecord } from '@driftline/aviation-domain';

export interface DocumentShareEvidence {
  readonly byteLength: number;
  readonly expectedUri: string;
  readonly hasPdfContainerMarkers: boolean;
  readonly sha256: string;
}

export const validateDocumentShareEvidence = (
  source: DocumentRecord,
  evidence: DocumentShareEvidence,
): DocumentRecord => {
  const document = documentRecordSchema.parse(source);
  if (document.deletedAt !== null) throw new Error('Deleted documents cannot be shared.');
  if (document.localUri !== evidence.expectedUri) {
    throw new Error('Document storage location does not match its registered path.');
  }
  if (evidence.byteLength !== document.byteLength) {
    throw new Error('Stored PDF byte length does not match imported metadata.');
  }
  if (!evidence.hasPdfContainerMarkers) {
    throw new Error('Stored file no longer passes the PDF container boundary.');
  }
  if (evidence.sha256 !== document.sha256) {
    throw new Error('Stored PDF digest does not match the imported copy.');
  }
  return document;
};
