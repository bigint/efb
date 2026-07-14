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
- A malformed stored row blocks the ledger and its totals; the UI does not silently omit it.
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
tests remain required before this module can pass a release gate.
