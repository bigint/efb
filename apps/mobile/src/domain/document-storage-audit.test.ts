import { describe, expect, it } from 'vitest';

import { reconcileDocumentStorageIndex } from './document-storage-audit';

const expectation = {
  byteLength: 1_024,
  expectedUri: 'file:///documents/driftline-documents/id.pdf',
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
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
    const moved = {
      ...expectation,
      id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
      recordedUri: 'file:///elsewhere/moved.pdf',
    };
    const missing = {
      ...expectation,
      expectedUri: 'file:///documents/driftline-documents/missing.pdf',
      id: '019f5f42-a146-7c00-861d-7ad2313bbbd6',
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
      missingDocumentIds: ['019f5f42-a146-7c00-861d-7ad2313bbbd6'],
      orphanEntryCount: 1,
      sizeMismatchDocumentIds: ['019f5f42-a146-7c00-861d-7ad2313bbbd5'],
      status: 'attention',
      unexpectedLocationDocumentIds: ['019f5f42-a146-7c00-861d-7ad2313bbbd5'],
    });
  });

  it('rejects duplicate filesystem entries rather than choosing one', () => {
    const entry = { byteLength: 1_024, kind: 'file' as const, uri: expectation.expectedUri };
    expect(() => reconcileDocumentStorageIndex([expectation], [entry, entry])).toThrow(
      'duplicate entries',
    );
    expect(() =>
      reconcileDocumentStorageIndex([{ ...expectation, id: 'unsafe\nid' }], [entry]),
    ).toThrow('expectation');
    expect(() =>
      reconcileDocumentStorageIndex([expectation], [{ ...entry, byteLength: -1 }]),
    ).toThrow('entry');
  });
});
