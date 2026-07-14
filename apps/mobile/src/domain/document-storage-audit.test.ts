import { describe, expect, it } from 'vitest';

import { reconcileDocumentStorageIndex } from './document-storage-audit';

const expectation = {
  byteLength: 1_024,
  expectedUri: 'file:///documents/driftline-documents/id.pdf',
  id: 'id',
  recordedUri: 'file:///documents/driftline-documents/id.pdf',
};

describe('document storage audit', () => {
  it('accepts an exact registered file mapping', () => {
    expect(
      reconcileDocumentStorageIndex(
        [expectation],
        [{ byteLength: 1_024, kind: 'file', uri: expectation.expectedUri }],
      ),
    ).toEqual({
      checkedDocuments: 1,
      missingDocumentIds: [],
      orphanEntryCount: 0,
      sizeMismatchDocumentIds: [],
      status: 'healthy',
      unexpectedLocationDocumentIds: [],
    });
  });

  it('reports missing, moved, changed-size, and orphaned records without mutating input', () => {
    const moved = { ...expectation, id: 'moved', recordedUri: 'file:///elsewhere/moved.pdf' };
    const missing = {
      ...expectation,
      expectedUri: 'file:///documents/driftline-documents/missing.pdf',
      id: 'missing',
      recordedUri: 'file:///documents/driftline-documents/missing.pdf',
    };
    expect(
      reconcileDocumentStorageIndex(
        [moved, missing],
        [
          { byteLength: 900, kind: 'file', uri: moved.expectedUri },
          { byteLength: null, kind: 'directory', uri: 'file:///documents/unexpected' },
        ],
      ),
    ).toMatchObject({
      missingDocumentIds: ['missing'],
      orphanEntryCount: 1,
      sizeMismatchDocumentIds: ['moved'],
      status: 'attention',
      unexpectedLocationDocumentIds: ['moved'],
    });
  });

  it('rejects duplicate filesystem entries rather than choosing one', () => {
    const entry = { byteLength: 1_024, kind: 'file' as const, uri: expectation.expectedUri };
    expect(() => reconcileDocumentStorageIndex([expectation], [entry, entry])).toThrow(
      'duplicate entries',
    );
  });
});
