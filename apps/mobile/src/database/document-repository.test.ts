import { describe, expect, it } from 'vitest';

import { decodeDocumentRows, listDocuments } from './document-repository';

const row = {
  byte_length: 1024,
  deleted_at: null,
  display_name: 'Fixture.pdf',
  folder: 'Unfiled',
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  imported_at: '2026-07-14T10:00:00.000Z',
  is_favourite: 0,
  last_opened_at: null,
  local_uri: 'file:///documents/fixture.pdf',
  mime_type: 'application/pdf',
  page_count: null,
  sha256: 'a'.repeat(64),
  source: 'user-imported',
  storage_scope: 'app-private',
  text_index_status: 'unavailable',
};

describe('document SQLite read boundary', () => {
  it('decodes document and bookmark relations', () => {
    expect(
      decodeDocumentRows(
        [row],
        [
          {
            created_at: '2026-07-14T11:00:00.000Z',
            document_id: row.id,
            label: 'Fuel table',
            page_index: 2,
          },
        ],
      ),
    ).toMatchObject([{ bookmarks: [{ label: 'Fuel table', pageIndex: 2 }] }]);
  });

  it('rejects invalid SQLite boolean encodings', () => {
    expect(() => decodeDocumentRows([{ ...row, is_favourite: 2 }], [])).toThrow();
  });

  it('rejects orphan bookmark relations', () => {
    expect(() =>
      decodeDocumentRows(
        [],
        [
          {
            created_at: '2026-07-14T11:00:00.000Z',
            document_id: row.id,
            label: 'Orphan',
            page_index: 0,
          },
        ],
      ),
    ).toThrow('unavailable document');
  });

  it('rejects control characters in persisted organization metadata', () => {
    expect(() => decodeDocumentRows([{ ...row, folder: 'Bad\nFolder' }], [])).toThrow(
      'control characters',
    );
    expect(() =>
      decodeDocumentRows(
        [row],
        [
          {
            created_at: '2026-07-14T11:00:00.000Z',
            document_id: row.id,
            label: 'Bad\u0000Label',
            page_index: 0,
          },
        ],
      ),
    ).toThrow('control characters');
  });

  it('reconstructs document metadata and bookmarks in one exclusive snapshot', async () => {
    let transactionCount = 0;
    const database = {
      getAllAsync: (sql: string) =>
        Promise.resolve(sql.includes('FROM documents WHERE') ? [row] : []),
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) => {
        transactionCount += 1;
        return operation(database);
      },
    };
    await expect(listDocuments(database as never)).resolves.toHaveLength(1);
    expect(transactionCount).toBe(1);
  });
});
