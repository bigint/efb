# ADR-0003: offline persistence and atomic dataset generations

- Status: proposed; activation protocol requires fault-injection prototype
- Date: 2026-07-14

## Context

Core workflows must operate offline after download. Aviation data is large, versioned,
geographically packaged, and safety-sensitive; user-created data must survive failed updates.
SQLite and MMKV have different guarantees and should not be treated as interchangeable
persistence mechanisms.

## Decision

Use three distinct storage classes:

1. **`user.sqlite`:** authoritative mutable routes, aircraft profiles, loading scenarios,
   documents metadata, checklists, logbook foundation, planning snapshots, settings requiring
   auditability, revisions, and sync outbox.
2. **`control.sqlite`:** small authoritative registry of installed/staging/ quarantined dataset
   generations, active and rollback generation IDs, migrations, checks, and activation audit. It
   never contains bulk aviation rows.
3. **Immutable generation directories:** normalized aviation SQLite database(s), tiles/assets,
   and a canonical signed manifest. A generation is never modified after verification; updates
   create a new unique generation.

Use MMKV only for small, high-frequency, reconstructible preferences and launch hints such as
theme, panel layout, map declutter settings, and last non-sensitive screen. Do not put routes,
flight records, dataset authority, acknowledgement of safety limitations, credentials, outbox
operations, or freshness/provenance in MMKV. MMKV's synchronous interface is not permission to
write large values on a hot path.

### Generation activation protocol

1. Fetch a manifest into a UUID-named staging directory. Require schema version, generation ID,
   produced/effective/expiry times, jurisdiction, source/licence metadata, minimum app version,
   every file size/hash, and signature metadata.
2. Confirm free space for candidate plus active and rollback generations and temporary download
   overhead. If capacity is insufficient, pause and offer explicit cleanup; never delete the
   active generation.
3. Download resumable chunks to temporary filenames. Hash the complete files, verify signature
   against a pinned/trusted key policy, and reject path traversal, duplicate IDs, unexpected
   files, downgrade, or incompatible schema.
4. Open candidate SQLite read-only. Apply `quick_check` during construction and full
   `integrity_check` before activation, then verify schema/user version, foreign keys,
   coordinate/range constraints, expected indexes, bounds, counts, and known sentinel queries.
5. Mark candidate `verified` in `control.sqlite`. In one exclusive control transaction, change
   `active_generation_id` and `rollback_generation_id`. This logical pointer transaction is the
   atomic swap; bulk database files are never overwritten in place.
6. Repository leases opened after commit use the new immutable generation. Existing reads drain
   against the old one, then handles close. Run post-commit smoke queries before garbage
   collection.
7. If post-commit checks fail, transactionally restore the rollback ID, quarantine the candidate
   with reason, and reopen repositories. Retain at least one last-known-good generation subject
   to explicit storage policy.

Tiles and aviation tables in a generation share the manifest and activation ID, preventing
mixed-cycle display. Weather observations remain a separate time-stamped cache because their
validity cadence does not match chart/data cycles.

Use SQLite WAL for mutable control/user databases after device testing, with foreign keys
enabled and explicit transactions. Do not assume WAL makes a group of separate databases atomic;
the activation pointer is updated only in `control.sqlite`, and immutable candidate files are
complete before that commit. Run checkpoints during safe lifecycle windows and back up
`user.sqlite` before schema migrations. Heavy synchronous Expo SQLite APIs are prohibited on the
JS thread.

## Query and packaging boundary

- Repositories capture one `DatasetLease` for the duration of an operation, so a search or route
  calculation cannot mix generations mid-call.
- Regional downloads are build inputs to a coherent generation. The mobile data installer may
  assemble the generation off the JS thread or install a pre-composed provider package. The
  query layer must not attach an unbounded number of region databases.
- Large map tiles use renderer-supported offline storage/packages under the same manifest
  lifecycle rather than being stored as MMKV blobs.
- Source artefacts remain build-side. Mobile ships normalized, indexed runtime data plus enough
  provenance/licence metadata to identify its origin.

## Performance budgets

- Airport search: <= 100 ms p95 for first 20 local results over the defined full-size fixture,
  using indexes/FTS and canceling superseded searches.
- Activation: <= 500 ms visible switch pause; hashing, decompression, validation, and database
  construction run outside the JS/UI thread with progress.
- Navigation SQLite work: no synchronous query/import on every position tick. Prefetch
  route/feature snapshots and use bounded spatial queries.
- Cold launch: registry read and open of the active generation fit within the <= 3 s shell
  budget. Integrity checks run at installation or recovery, not a full scan on every launch.
- Storage: download admission includes candidate + active + rollback + temporary overhead. Phase
  2 records peak disk multiplier with representative regions.

## Failure recovery matrix

| Kill/failure point                        | Expected next launch                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| before verified marker                    | active unchanged; resume or delete staging                                                                   |
| after verified, before pointer commit     | active unchanged; candidate remains eligible                                                                 |
| during pointer transaction                | SQLite rolls transaction back or commits one complete pointer state                                          |
| after pointer commit, before smoke result | validate active; use it or rollback and quarantine                                                           |
| corrupt active file                       | refuse affected reads, rollback to verified generation                                                       |
| corrupt control DB                        | recover from its backup and scan signed generation manifests; require confirmation if authority is ambiguous |
| corrupt user DB/migration                 | restore backup or enter read-only export/recovery; never reset silently                                      |
| MMKV failure                              | reset rebuildable preferences and reconstruct hints from authoritative stores                                |
| low disk                                  | stop download before endangering user/active data; expose cleanup candidates                                 |

Fault tests must inject termination at every state transition and mutate each
manifest/file/checksum/schema field. Device tests include abrupt OS kill, low disk, clock
change, concurrent search during activation, and rollback.

## Alternatives considered

- **Replace `aviation.sqlite` in place:** open handles and partial filesystem operations make
  recovery harder; rejected in favor of immutable versioned files plus a transactional pointer.
- **One SQLite database for user and published data:** swapping or rebuilding it risks user data
  and couples unrelated migrations; rejected.
- **MMKV as general persistence:** fast key/value access does not supply the relational
  transactions, queryability, or authority model required; rejected.
- **Persist everything in TanStack Query:** a cache eviction/buster must not remove core offline
  or user data; rejected.
- **Server as offline source of truth:** violates core offline operation; rejected.

## Implementation sequence

1. Define manifest, generation state machine, data-confidence fields, and key
   rotation/revocation policy with Security and Data Leads.
2. Build user/control schemas, migrations, backups, repositories, and lease API.
3. Package and activate a small signed fixture generation; inject every kill point before
   implementing large downloads.
4. Benchmark Expo SQLite and filesystem work on real devices; introduce a narrow native
   installer only if async APIs cannot meet responsiveness.
5. Add resumable regional downloads, disk admission, full validation, rollback, quarantine, and
   UI provenance.
6. Scale fixtures to production-like row/tile density and enforce budgets.

## References

- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [SQLite: atomic commit](https://www.sqlite.org/atomiccommit.html)
- [SQLite: write-ahead logging](https://www.sqlite.org/wal.html)
- [SQLite: PRAGMA integrity_check and quick_check](https://www.sqlite.org/pragma.html#pragma_integrity_check)
- [SQLite online backup API](https://www.sqlite.org/backup.html)
- [react-native-mmkv official repository](https://github.com/mrousavy/react-native-mmkv)
