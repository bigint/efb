import { describe, expect, it } from 'vitest';

import { documentRecordSchema } from '@driftline/aviation-domain';

import { validateDocumentShareEvidence } from './document-share-boundary';

const document = documentRecordSchema.parse({
  bookmarks: [],
  byteLength: 1_024,
  deletedAt: null,
  displayName: 'POH.pdf',
  folder: 'Unfiled',
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  importedAt: '2026-07-14T10:00:00.000Z',
  isFavourite: false,
  lastOpenedAt: null,
  localUri: 'file:///documents/driftline-documents/019f5f42-a146-7c00-861d-7ad2313bbbd4.pdf',
  mimeType: 'application/pdf',
  pageCount: null,
  sha256: 'a'.repeat(64),
  source: 'user-imported',
  storageScope: 'app-private',
  textIndexStatus: 'unavailable',
});

const evidence = {
  byteLength: document.byteLength,
  expectedUri: document.localUri,
  hasPdfContainerMarkers: true,
  sha256: document.sha256,
};

describe('document share boundary', () => {
  it('accepts a registered byte-for-byte PDF identity', () => {
    expect(validateDocumentShareEvidence(document, evidence)).toEqual(document);
  });

  it.each([
    ['path', { expectedUri: 'file:///elsewhere.pdf' }],
    ['byte length', { byteLength: 1_023 }],
    ['container', { hasPdfContainerMarkers: false }],
    ['digest', { sha256: 'b'.repeat(64) }],
  ])('rejects changed %s evidence', (_label, change) => {
    expect(() => validateDocumentShareEvidence(document, { ...evidence, ...change })).toThrow();
  });
});
