import { describe, expect, it } from 'vitest';

import {
  addDocumentBookmark,
  documentIdSchema,
  documentRecordSchema,
  hasPdfContainerMarkers,
  MAX_IMPORTED_PDF_BYTES,
  type DocumentRecord,
} from './document';

const record = (overrides: Partial<DocumentRecord> = {}): DocumentRecord =>
  documentRecordSchema.parse({
    bookmarks: [],
    byteLength: 1024,
    deletedAt: null,
    displayName: 'Pilot notes.pdf',
    folder: 'Unfiled',
    id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
    importedAt: '2026-07-14T10:00:00.000Z',
    isFavourite: false,
    lastOpenedAt: null,
    localUri: 'file:///documents/record.pdf',
    mimeType: 'application/pdf',
    pageCount: null,
    sha256: 'a'.repeat(64),
    source: 'user-imported',
    storageScope: 'app-private',
    textIndexStatus: 'unavailable',
    ...overrides,
  });

describe('document domain', () => {
  it('requires PDF header and EOF markers in bounded container regions', () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\nfixture\n%%EOF\n');
    expect(hasPdfContainerMarkers(bytes)).toBe(true);
    expect(hasPdfContainerMarkers(new TextEncoder().encode('%PDF-1.7\ntruncated'))).toBe(false);
    expect(hasPdfContainerMarkers(new TextEncoder().encode('not a pdf\n%%EOF'))).toBe(false);
  });

  it('accepts only bounded app-private PDF records', () => {
    expect(record()).toMatchObject({
      mimeType: 'application/pdf',
      storageScope: 'app-private',
    });
    expect(() => record({ byteLength: MAX_IMPORTED_PDF_BYTES + 1 })).toThrow();
    expect(() => record({ localUri: 'https://example.com/file.pdf' })).toThrow();
    expect(() => record({ mimeType: 'text/plain' as 'application/pdf' })).toThrow();
    expect(documentIdSchema.safeParse('../escape').success).toBe(false);
  });

  it('rejects unsafe display names and contradictory chronology', () => {
    expect(() => record({ displayName: 'bad\u0000name.pdf' })).toThrow('control characters');
    expect(() => record({ lastOpenedAt: '2026-07-14T09:00:00.000Z' })).toThrow(
      'cannot precede',
    );
  });

  it('adds unique in-range bookmarks', () => {
    const bookmarked = addDocumentBookmark(
      record({ pageCount: 2 }),
      1,
      'Fuel table',
      '2026-07-14T11:00:00.000Z',
    );
    expect(bookmarked.bookmarks).toHaveLength(1);
    expect(() =>
      addDocumentBookmark(bookmarked, 1, 'Fuel table', '2026-07-14T11:01:00.000Z'),
    ).toThrow('unique');
    expect(() =>
      addDocumentBookmark(record({ pageCount: 2 }), 2, 'Outside', '2026-07-14T11:00:00.000Z'),
    ).toThrow('outside');
  });
});
