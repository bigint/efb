# Flight-plan persistence

## Ownership correction

Saved flight plans are durable user intent and now live in `user.sqlite`. The active route
editor remains an ephemeral Zustand session. Persistence version 4 keeps the existing MMKV
preference key for workspace, selection, and position-source intent, but removes route
identifiers from new writes and deliberately discards a legacy MMKV route during restore. An
unsaved route is honestly lost after process death; a route is described as saved only after the
SQLite transaction commits.

## Saved model

A saved flight contains a UUID, bounded title and notes, timestamps, status, revision, optional
departure time/altitude/aircraft reference, and up to 100 ordered waypoints. Each waypoint
stores:

- a contiguous zero-based sequence;
- a normalized unique identifier;
- a bounded latitude and longitude; and
- the dataset/source reference that supplied the coordinate.

The current Plan workspace saves resolved routes with at least two fictional demonstration
waypoints as revision-one drafts. Planning wind assumptions are not saved and the UI does not
claim otherwise.

Saved drafts can be renamed and archived. Each action creates exactly the next revision and uses
the same compare-and-swap update boundary; a conflict reloads current storage before reporting
the error. Archive requires native destructive confirmation, hides the record from the active
list, and retains its row and waypoint snapshot locally. A separately bounded archived list can
restore that record as a draft through another next-revision compare-and-swap update.

New drafts may optionally reference one of at most 100 validated local aircraft profiles. The
profile UUID is protected by SQLite's foreign key and the saved-flight list resolves the current
normalized registration for display. Profile retrieval failures do not hide route records or
block unassigned saves; they clear any transient selection and expose the reference as
unavailable.

A saved draft route can be replaced only from a current route with at least two resolved
waypoints. Native destructive confirmation names the replacement sequence and warns that the
prior waypoint snapshot is not retained. The replacement is re-snapshotted with coordinates and
source references and committed through the same next-revision compare-and-swap transaction.

## Repository semantics

Creation inserts the flight and all ordered waypoints in one exclusive SQLite transaction with
bound parameters. The update repository accepts only the next revision, uses
`WHERE id = ? AND revision = ?`, and replaces relational waypoints within the same transaction.
A zero-row update is treated as a concurrent-writer conflict; partial waypoint replacement rolls
back.

Reads bound collection size, reconstruct relational waypoint order, and revalidate the entire
domain object. Owner mismatches, sequence gaps, duplicate identifiers, malformed coordinates,
bad timestamps, or invalid revisions stop the saved-flight library.

## Dataset drift

Loading does not trust identifier equality alone. The saved identifier, coordinates, and source
reference must exactly match the active waypoint candidate. A mismatch blocks loading and names
the affected identifiers. This prevents an old route snapshot from silently taking on new
geometry under the same identifier.

## Current limitations

The editor can create, load, rename, replace routes, archive, and restore drafts. Plan selection
across the whole shell, revising an existing aircraft assignment, altitude/departure editing,
assumption snapshots, outbox sync, richer conflict UI, and native
process-death/visual/accessibility evidence remain open. The included waypoints are fictional
and unverified, so saved routes are not suitable for navigation.
