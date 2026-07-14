# Document library foundation

The Library accepts one user-selected PDF at a time through the native system picker. Selection
uses `copyToCacheDirectory: true`, as required for immediate Expo FileSystem access. The
importer then owns a separate app-private copy under a UUID filename; the original display name
never participates in path construction.

## Import boundary

1. Validate the caller-supplied UUID before constructing a destination path.
2. Ask the system picker for `application/pdf` only and reject a conflicting returned MIME type.
3. Reject empty, indeterminate, changed, or larger-than-25,000,000-byte inputs.
4. Require `%PDF-` near the start and `%%EOF` near the end. These are container gates, not a
   claim that the PDF is safe to render.
5. SHA-256 the cache copy, copy it to the app document directory, read the destination, and
   require identical length and SHA-256 before inserting metadata.
6. If validation or SQLite insertion fails, delete the destination on a best-effort basis.
   Startup orphan reconciliation remains required because a platform deletion can itself fail.

SQLite stores app-private scope, display name, byte length, digest, folder, favourite/recent
metadata, optional page count, text-index state, and relational bookmarks. Every row and
bookmark is revalidated on read; corrupt metadata blocks the library instead of disappearing
from results.

## Deliberately unavailable

Native PDF rendering, text extraction/search, page-count discovery, annotations, bookmark UI,
sharing/export, deletion/reconciliation, malicious-PDF sandboxing, and backup/restore are not
enabled. The mobile surface says `READER NOT VERIFIED` and does not open imported bytes. A
container marker and digest make a file identifiable and complete; they do not make its content
trusted.

Implementation follows the Expo DocumentPicker immediate-read pattern, Expo FileSystem's
app-local `File`/`Directory` APIs, and Expo Crypto SHA-256. Native malformed-file, memory,
interruption, accessibility, and process-death evidence remains a release gate.
