# Airport favourites

Airport favourites are durable user preference, not aviation source data. User database
migration v7 adds a strict table containing only a normalized airport identifier and creation
timestamp. It deliberately has no foreign key to the control/dataset database: dataset
activation, rollback, or temporary absence cannot delete user intent.

The repository bounds reads to 100 rows, validates timestamps and identifiers at every read, and
rejects normalized duplicates. Add uses an idempotent parameterized insert; removal uses a
parameterized delete. The Places workspace resolves identifiers against the active airport
collection for display, but retains unresolved favourites for a future dataset rather than
silently deleting them.

Favourite loading is isolated from airport search/detail. A malformed preference removes stars
and exposes a local error while the validated airport fixture remains browsable. The current
slice has no favourite-only filter, cloud sync, export, deleted-airport explanation, or
physical-device recovery/accessibility evidence.
