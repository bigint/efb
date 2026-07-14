# User database

Driftline opens a dedicated `driftline-user-v1.db` SQLite database before rendering the mobile
application. It owns durable user records: aircraft profiles, flights and route points,
checklist definitions and runs, imported-document metadata, logbook entries, and offline-region
state.

## Guarantees

- SQLite foreign keys are enabled on every open and the database uses write-ahead logging.
- Migrations are versioned, contiguous, static application SQL and run in exclusive
  transactions. User input is never interpolated into migration statements.
- An invalid version, a database created by a newer app, a failed migration, or a mismatched
  final version aborts initialization. The app does not render against a partially understood
  schema.
- Referential and numeric constraints live in SQLite as a final integrity boundary; domain
  validation remains required before every write.
- Imported documents remain local files. SQLite stores only metadata, integrity digests and
  bookmarks.

The current route sandbox remains a non-operational MMKV preference while repository adapters
are built. It must not be treated as the durable flight record.

This follows Expo's documented `SQLiteProvider` initialization and migration pattern. Native
device validation remains required before Phase 1 can pass.
