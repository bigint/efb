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

const MAXIMUM_STORAGE_RECORDS = 10_000;
const validUri = (value: string): boolean =>
  value.length >= 8 &&
  value.length <= 2_048 &&
  value.startsWith('file://') &&
  [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code !== 127;
  });
const validId = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);

export const reconcileDocumentStorageIndex = (
  expectations: readonly DocumentStorageExpectation[],
  entries: readonly DocumentStorageEntry[],
): DocumentStorageAudit => {
  if (
    expectations.length > MAXIMUM_STORAGE_RECORDS ||
    entries.length > MAXIMUM_STORAGE_RECORDS
  ) {
    throw new RangeError('Document storage audit exceeds the supported record limit');
  }
  const entryByUri = new Map<string, DocumentStorageEntry>();
  for (const entry of entries) {
    const kind: unknown = entry.kind;
    if (
      !validUri(entry.uri) ||
      (kind !== 'directory' && kind !== 'file') ||
      (entry.byteLength !== null &&
        (!Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0))
    ) {
      throw new RangeError('Document storage entry is invalid');
    }
    if (entryByUri.has(entry.uri))
      throw new Error('Document storage contains duplicate entries');
    entryByUri.set(entry.uri, entry);
  }
  const expectedUris = new Set<string>();
  const missingDocumentIds: string[] = [];
  const sizeMismatchDocumentIds: string[] = [];
  const unexpectedLocationDocumentIds: string[] = [];
  for (const expectation of expectations) {
    if (
      !validId(expectation.id) ||
      !validUri(expectation.expectedUri) ||
      !validUri(expectation.recordedUri) ||
      !Number.isSafeInteger(expectation.byteLength) ||
      expectation.byteLength <= 0 ||
      expectation.byteLength > 25_000_000
    ) {
      throw new RangeError('Document storage expectation is invalid');
    }
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
