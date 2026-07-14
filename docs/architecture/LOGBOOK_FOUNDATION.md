# Logbook foundation

The Records workspace is an offline, device-local ledger backed by the user SQLite database. It
captures date, aircraft registration, departure, arrival, block, flight, day, night, PIC, SIC,
dual, instructor, instrument, approaches, landings, remarks, and relational document attachment
references. The mobile form exposes a conservative subset plus saved-aircraft selection and up
to 20 imported-document attachments; the schema retains the broader model for later editing and
import workflows.

## Integrity boundaries

- Durations enter and display as explicit `H:MM` values and persist as non-negative whole
  minutes. Per-entry values are bounded; summaries use safe-integer accumulation.
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

## Regulatory boundary

Every entry has a jurisdiction label and the literal compliance state `not-evaluated`. The
current UI uses `UNCLASSIFIED` and states that it does not determine regulator, licence,
recency, endorsement, or retention compliance. Future jurisdiction modules may evaluate
separately, but must never rewrite recorded flight facts or turn an unevaluated entry into a
compliant claim by default.

Native process-death, migration interruption, backup/export, accessibility, and physical-device
tests remain required before this module can pass a release gate. Historical rows are
semantically revalidated only when their page is browsed; aggregate totals do not imply
regulatory or semantic validation of every historical row.
