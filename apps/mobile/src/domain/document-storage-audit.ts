export interface DocumentStorageExpectation {
  readonly byteLength: number;
  readonly expectedUri: string;
  readonly id: string;
  readonly recordedUri: string;
}

export interface DocumentStorageEntry {
  readonly byteLength: number | null;
  readonly kind: 'directory' | 'file';
  readonly uri: string;
}

export interface DocumentStorageAudit {
  readonly checkedDocuments: number;
  readonly missingDocumentIds: readonly string[];
  readonly orphanEntryCount: number;
  readonly sizeMismatchDocumentIds: readonly string[];
  readonly status: 'attention' | 'healthy';
  readonly unexpectedLocationDocumentIds: readonly string[];
}

export const reconcileDocumentStorageIndex = (
  expectations: readonly DocumentStorageExpectation[],
  entries: readonly DocumentStorageEntry[],
): DocumentStorageAudit => {
  const entryByUri = new Map<string, DocumentStorageEntry>();
  for (const entry of entries) {
    if (entryByUri.has(entry.uri))
      throw new Error('Document storage contains duplicate entries');
    entryByUri.set(entry.uri, entry);
  }
  const expectedUris = new Set<string>();
  const missingDocumentIds: string[] = [];
  const sizeMismatchDocumentIds: string[] = [];
  const unexpectedLocationDocumentIds: string[] = [];
  for (const expectation of expectations) {
    if (expectedUris.has(expectation.expectedUri)) {
      throw new Error('Document storage expectations contain a duplicate path');
    }
    expectedUris.add(expectation.expectedUri);
    if (expectation.recordedUri !== expectation.expectedUri) {
      unexpectedLocationDocumentIds.push(expectation.id);
    }
    const entry = entryByUri.get(expectation.expectedUri);
    if (entry === undefined || entry.kind !== 'file') {
      missingDocumentIds.push(expectation.id);
    } else if (entry.byteLength !== expectation.byteLength) {
      sizeMismatchDocumentIds.push(expectation.id);
    }
  }
  const orphanEntryCount = entries.filter((entry) => !expectedUris.has(entry.uri)).length;
  const status =
    missingDocumentIds.length === 0 &&
    sizeMismatchDocumentIds.length === 0 &&
    unexpectedLocationDocumentIds.length === 0 &&
    orphanEntryCount === 0
      ? 'healthy'
      : 'attention';
  return {
    checkedDocuments: expectations.length,
    missingDocumentIds,
    orphanEntryCount,
    sizeMismatchDocumentIds,
    status,
    unexpectedLocationDocumentIds,
  };
};
