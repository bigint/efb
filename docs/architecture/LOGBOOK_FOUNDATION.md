# Logbook foundation

The Records workspace is an offline, device-local ledger backed by the user SQLite database. It
captures date, aircraft registration, departure, arrival, block, flight, day, night, PIC, SIC,
dual, instructor, instrument, approaches, landings, remarks, and relational document attachment
references. The mobile form exposes each of those recorded fact fields plus saved-aircraft
selection and up to 20 imported-document attachments. Editing, import, signatures, and
regulatory interpretation remain separate future workflows.

## Integrity boundaries

- Durations enter and display as explicit `H:MM` values and persist as non-negative whole
  minutes. Per-entry values are bounded; summaries use safe-integer accumulation.
- Approach and day/night landing counts accept canonical whole numbers from 0 through 100. The
  form does not derive or infer them from other fields.
- Flight cannot exceed block. Day plus night and PIC plus SIC cannot exceed flight, and every
  other time category is individually bounded by flight time.
- Calendar dates, UUIDs, station identifiers, timestamps, attachment uniqueness, and update
  chronology are validated before parameterized SQLite writes and again when rows are read.
- A malformed row in the loaded recent page or an invalid numeric aggregate blocks the ledger;
  neither is silently omitted from the current view.
- The Records list loads domain-validated entries in deterministic pages of at most 100 and at
  most 2,000 attachment relations per page. A validated `(flight_date, created_at, id)` keyset
  cursor retrieves older entries without offset drift, and each row/attachment page shares one
  exclusive read transaction. All-time additive totals are computed separately by
  constant-memory SQLite aggregates, then checked as non-negative safe integers before display.
  The heading states exactly how many rows are loaded out of the aggregate entry count.
- Aircraft and document reference libraries load independently from logbook entries. Reference
  corruption disables selection and clears ephemeral selections without hiding valid ledger
  rows. A selected aircraft UUID must still exist in the loaded library and its registration
  must match the immutable registration snapshot before save.
- Entry creation and all attachment relation inserts share one exclusive transaction. A missing
  or concurrently removed aircraft/document reference trips the SQLite foreign key and rolls the
  whole entry back.
- The committed v1 schema remains immutable. User migration v2 rebuilds the logbook table inside
  an exclusive transaction, preserves v1 rows, derives day time from flight minus night, adds
  the richer columns and attachment relation, and removes the obsolete dataset-state table.
- A database initialization error renders a recovery surface rather than the normal app shell.

## CSV snapshot boundary

CSV export is available only when every summary-counted entry is loaded and the collection is no
larger than 2,000 entries. Each row is domain-validated again before serialization, duplicate
entry identifiers fail closed, and stored whole-minute/count values are exported without
decimal-hour or locale conversion. All text cells are quoted, embedded quotes are escaped, and
leading spreadsheet formula characters are prefixed defensively. Attachment UUIDs are included
as references; attached documents are not bundled.

The file is written to app cache, read back byte-for-byte as text before the native share sheet
is opened, and removed after the sheet closes when cleanup succeeds. A share-sheet close is not
called a successful transfer: the UI tells the user to confirm the destination. If native
sharing is unavailable, the private cache URI remains visible. The snapshot is not a backup,
signed record, regulatory export, or compliance report.

## Regulatory boundary

Every entry has a jurisdiction label and the literal compliance state `not-evaluated`. The
current UI uses `UNCLASSIFIED`, displays the recorded time/category facts on each loaded row,
and states that it does not determine regulator, licence, recency, endorsement, or retention
compliance. Future jurisdiction modules may evaluate separately, but must never rewrite recorded
flight facts or turn an unevaluated entry into a compliant claim by default.

Native process-death, migration interruption, backup/restore, share-sheet, accessibility, and
physical-device tests remain required before this module can pass a release gate. Historical
rows are semantically revalidated only when their page is browsed; aggregate totals do not imply
regulatory or semantic validation of every historical row.
