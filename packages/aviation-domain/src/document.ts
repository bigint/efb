import { z } from 'zod';

export const MAX_IMPORTED_PDF_BYTES = 25_000_000;
export const documentIdSchema = z.uuid();

const hasNoControlCharacters = (value: string): boolean =>
  [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code !== 127;
  });

const documentBookmarkSchema = z
  .object({
    createdAt: z.iso.datetime(),
    label: z.string().trim().min(1).max(120),
    pageIndex: z.number().int().min(0).max(99_999),
  })
  .strict();

export const documentRecordSchema = z
  .object({
    bookmarks: z.array(documentBookmarkSchema).max(500),
    byteLength: z.number().int().positive().max(MAX_IMPORTED_PDF_BYTES),
    deletedAt: z.iso.datetime().nullable(),
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .refine(hasNoControlCharacters, 'Display name has control characters'),
    folder: z.string().trim().min(1).max(120),
    id: documentIdSchema,
    importedAt: z.iso.datetime(),
    isFavourite: z.boolean(),
    lastOpenedAt: z.iso.datetime().nullable(),
    localUri: z.string().max(2_048).startsWith('file://'),
    mimeType: z.literal('application/pdf'),
    pageCount: z.number().int().positive().max(100_000).nullable(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    source: z.literal('user-imported'),
    storageScope: z.literal('app-private'),
    textIndexStatus: z.enum(['unavailable', 'pending', 'ready', 'failed']),
  })
  .strict()
  .superRefine((document, context) => {
    const bookmarkKeys = new Set<string>();
    document.bookmarks.forEach((bookmark, index) => {
      const key = `${bookmark.pageIndex}\u0000${bookmark.label}`;
      if (bookmarkKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Document bookmarks must be unique by page and label',
          path: ['bookmarks', index],
        });
      }
      bookmarkKeys.add(key);
      if (document.pageCount !== null && bookmark.pageIndex >= document.pageCount) {
        context.addIssue({
          code: 'custom',
          message: 'Bookmark page is outside the known document range',
          path: ['bookmarks', index, 'pageIndex'],
        });
      }
    });
    if (
      document.lastOpenedAt !== null &&
      Date.parse(document.lastOpenedAt) < Date.parse(document.importedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Last-opened time cannot precede import',
        path: ['lastOpenedAt'],
      });
    }
    if (
      document.deletedAt !== null &&
      Date.parse(document.deletedAt) < Date.parse(document.importedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Deletion time cannot precede import',
        path: ['deletedAt'],
      });
    }
  });

export type DocumentRecord = z.infer<typeof documentRecordSchema>;

const findAscii = (bytes: Uint8Array, value: string, start: number, end: number): boolean => {
  const limit = Math.min(end, bytes.length) - value.length;
  for (let index = Math.max(0, start); index <= limit; index += 1) {
    let matched = true;
    for (let offset = 0; offset < value.length; offset += 1) {
      if (bytes[index + offset] !== value.charCodeAt(offset)) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
};

export const hasPdfContainerMarkers = (bytes: Uint8Array): boolean =>
  findAscii(bytes, '%PDF-', 0, 1_024) &&
  findAscii(bytes, '%%EOF', Math.max(0, bytes.length - 2_048), bytes.length);

export const addDocumentBookmark = (
  source: DocumentRecord,
  pageIndex: number,
  label: string,
  createdAt: string,
): DocumentRecord => {
  const document = documentRecordSchema.parse(source);
  return documentRecordSchema.parse({
    ...document,
    bookmarks: [...document.bookmarks, { createdAt, label, pageIndex }],
  });
};
