import {
  addDocumentBookmark,
  documentRecordSchema,
  type DocumentRecord,
} from '@driftline/aviation-domain';
import type { SQLiteDatabase } from 'expo-sqlite';

interface DocumentRow {
  readonly byte_length: number;
  readonly deleted_at: string | null;
  readonly display_name: string;
  readonly folder: string;
  readonly id: string;
  readonly imported_at: string;
  readonly is_favourite: number;
  readonly last_opened_at: string | null;
  readonly local_uri: string;
  readonly mime_type: string;
  readonly page_count: number | null;
  readonly sha256: string;
  readonly source: string;
  readonly storage_scope: string;
  readonly text_index_status: string;
}

interface BookmarkRow {
  readonly created_at: string;
  readonly document_id: string;
  readonly label: string;
  readonly page_index: number;
}

const MAX_LIBRARY_DOCUMENTS = 100;
const MAX_LIBRARY_BOOKMARKS = MAX_LIBRARY_DOCUMENTS * 500;

export const decodeDocumentRows = (
  rows: readonly DocumentRow[],
  bookmarkRows: readonly BookmarkRow[],
): readonly DocumentRecord[] => {
  const ids = new Set(rows.map(({ id }) => id));
  const bookmarks = new Map<string, BookmarkRow[]>();
  for (const bookmark of bookmarkRows) {
    if (!ids.has(bookmark.document_id)) {
      throw new Error('Document bookmark references an unavailable document');
    }
    const current = bookmarks.get(bookmark.document_id) ?? [];
    current.push(bookmark);
    bookmarks.set(bookmark.document_id, current);
  }
  return rows.map((row) => {
    if (row.is_favourite !== 0 && row.is_favourite !== 1) {
      throw new Error('Document favourite flag is invalid');
    }
    return documentRecordSchema.parse({
      bookmarks: (bookmarks.get(row.id) ?? []).map((bookmark) => ({
        createdAt: bookmark.created_at,
        label: bookmark.label,
        pageIndex: bookmark.page_index,
      })),
      byteLength: row.byte_length,
      deletedAt: row.deleted_at,
      displayName: row.display_name,
      folder: row.folder,
      id: row.id,
      importedAt: row.imported_at,
      isFavourite: row.is_favourite === 1,
      lastOpenedAt: row.last_opened_at,
      localUri: row.local_uri,
      mimeType: row.mime_type,
      pageCount: row.page_count,
      sha256: row.sha256,
      source: row.source,
      storageScope: row.storage_scope,
      textIndexStatus: row.text_index_status,
    });
  });
};

export const listDocuments = async (
  database: SQLiteDatabase,
): Promise<readonly DocumentRecord[]> => {
  const [rows, bookmarks] = await Promise.all([
    database.getAllAsync<DocumentRow>(
      `SELECT id, imported_at, display_name, local_uri, sha256, byte_length,
        mime_type, source, deleted_at, storage_scope, folder, is_favourite,
        last_opened_at, page_count, text_index_status
       FROM documents WHERE deleted_at IS NULL
       ORDER BY is_favourite DESC, COALESCE(last_opened_at, imported_at) DESC
       LIMIT ${MAX_LIBRARY_DOCUMENTS + 1}`,
    ),
    database.getAllAsync<BookmarkRow>(
      `SELECT bookmark.document_id, bookmark.page_index, bookmark.label, bookmark.created_at
       FROM document_bookmarks AS bookmark
       INNER JOIN documents AS document ON document.id = bookmark.document_id
       WHERE document.deleted_at IS NULL
       ORDER BY bookmark.document_id, bookmark.page_index, bookmark.label
       LIMIT ${MAX_LIBRARY_BOOKMARKS + 1}`,
    ),
  ]);
  if (rows.length > MAX_LIBRARY_DOCUMENTS || bookmarks.length > MAX_LIBRARY_BOOKMARKS) {
    throw new Error('Document library exceeds supported collection limits');
  }
  return decodeDocumentRows(rows, bookmarks);
};

export const insertDocument = async (
  database: SQLiteDatabase,
  source: DocumentRecord,
): Promise<void> => {
  const document = documentRecordSchema.parse(source);
  await database.runAsync(
    `INSERT INTO documents (
      id, imported_at, display_name, local_uri, sha256, byte_length, mime_type,
      source, deleted_at, storage_scope, folder, is_favourite, last_opened_at,
      page_count, text_index_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    document.id,
    document.importedAt,
    document.displayName,
    document.localUri,
    document.sha256,
    document.byteLength,
    document.mimeType,
    document.source,
    document.deletedAt,
    document.storageScope,
    document.folder,
    document.isFavourite ? 1 : 0,
    document.lastOpenedAt,
    document.pageCount,
    document.textIndexStatus,
  );
};

const requireOneChange = (changes: number): void => {
  if (changes !== 1) throw new Error('Document metadata changed on another writer.');
};

export const setDocumentFavourite = async (
  database: SQLiteDatabase,
  source: DocumentRecord,
  favourite: boolean,
): Promise<void> => {
  const document = documentRecordSchema.parse(source);
  if (document.isFavourite === favourite) return;
  const result = await database.runAsync(
    `UPDATE documents SET is_favourite = ?
     WHERE id = ? AND is_favourite = ? AND deleted_at IS NULL`,
    favourite ? 1 : 0,
    document.id,
    document.isFavourite ? 1 : 0,
  );
  requireOneChange(result.changes);
};

export const setDocumentFolder = async (
  database: SQLiteDatabase,
  source: DocumentRecord,
  folderInput: string,
): Promise<void> => {
  const document = documentRecordSchema.parse(source);
  const next = documentRecordSchema.parse({ ...document, folder: folderInput });
  if (next.folder === document.folder) return;
  const result = await database.runAsync(
    `UPDATE documents SET folder = ?
     WHERE id = ? AND folder = ? AND deleted_at IS NULL`,
    next.folder,
    document.id,
    document.folder,
  );
  requireOneChange(result.changes);
};

export const insertDocumentBookmark = async (
  database: SQLiteDatabase,
  source: DocumentRecord,
  pageIndex: number,
  label: string,
  createdAt: string,
): Promise<void> => {
  const document = documentRecordSchema.parse(source);
  const next = addDocumentBookmark(document, pageIndex, label, createdAt);
  const bookmark = next.bookmarks.at(-1);
  if (bookmark === undefined) throw new Error('Bookmark validation did not produce a record.');
  await database.runAsync(
    `INSERT INTO document_bookmarks (document_id, page_index, label, created_at)
     VALUES (?, ?, ?, ?)`,
    document.id,
    bookmark.pageIndex,
    bookmark.label,
    bookmark.createdAt,
  );
};
