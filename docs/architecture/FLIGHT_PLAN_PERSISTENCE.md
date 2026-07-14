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

The framework-independent route resolver and calculator repeat the 100-waypoint ceiling,
uppercase identifier shape, route/source uniqueness, and finite positive groundspeed checks.
They therefore fail closed even when a future adapter bypasses the persistence schema instead of
allocating an unbounded route or silently selecting one of two ambiguous waypoint records.

When a local aircraft is selected for a new draft and the constant-wind route resolves, Plan
multiplies wind-adjusted ETE by that profile's entered litres-per-hour cruise burn. It compares
the result with entered usable litres. This transient estimate is bounded to seven days and
never adds or implies taxi, climb, descent, contingency, alternate, or reserve fuel. Invalid
assumptions and missing aircraft remain unavailable rather than becoming zero consumption.

Transient wind-triangle inputs are finite and bounded to true airspeed above 0 through 1,000 KT
and wind from 0 through 500 KT. The pure solver repeats those limits, so a bypassed form cannot
overflow into plausible route time or crash rendering.

Plan can also select one fictional demonstration airport as a transient alternate. The
destination-to-alternate leg gets its own distance, constant-wind ETE, wind no-solution state,
and cruise-only fuel when an aircraft is available. It is explicitly excluded from the headline
route fuel and is cleared when the route destination changes. Alternate intent is not stored in
the current saved-flight schema.

Saved drafts can be renamed and archived. Each action creates exactly the next revision and uses
the same compare-and-swap update boundary; a conflict reloads current storage before reporting
the error. Archive requires native destructive confirmation, hides the record from the active
list, and retains its row and waypoint snapshot locally. A separately bounded archived list can
restore that record as a draft through another next-revision compare-and-swap update.

Active or archived records can also be duplicated into a new independent draft. Duplication
requires a new UUID and a creation clock no older than the source revision, resets revision to
one and status to draft, preserves route/detail snapshots, and creates a bounded `copy` title.
The source row is never revised by this operation; insertion still uses the all-or-nothing
creation transaction.

New drafts may optionally reference one of at most 100 validated local aircraft profiles. The
profile UUID is protected by SQLite's foreign key and the saved-flight list resolves the current
normalized registration for display. Profile retrieval failures do not hide route records or
block unassigned saves; they clear any transient selection and expose the reference as
unavailable.

A saved draft route can be replaced only from a current route with at least two resolved
waypoints. Native destructive confirmation names the replacement sequence and warns that the
prior waypoint snapshot is not retained. The replacement is re-snapshotted with coordinates and
source references and committed through the same next-revision compare-and-swap transaction.

The same detail editor revises title, optional aircraft assignment, optional cruise altitude,
optional departure time, and notes in one next-revision write. Altitude text accepts only whole
feet from 0 through 60,000. Departure text is deliberately restricted to an explicit UTC ISO
timestamp such as `2026-07-14T12:30:00Z`; locale-dependent or offset-bearing text is rejected
rather than guessed. Clearing an optional field persists `NULL`, and an unavailable linked
aircraft is preserved unless the user explicitly unassigns or replaces it.

The current resolved route can be shared as a GPX 1.1 route snapshot. Export is bounded to the
same 100-waypoint ceiling, revalidates every coordinate, rejects duplicate identifiers and XML
control characters, escapes XML text, and verifies the cache write before opening the native
share sheet. The file deliberately contains no invented altitude or timestamp. Both UI and file
metadata label the fictional demonstration route unverified and unsuitable as authoritative
navigation data; closing a share sheet is not presented as proof of delivery.

## Repository semantics

Creation inserts the flight and all ordered waypoints in one exclusive SQLite transaction with
bound parameters. The update repository accepts only the next revision, uses
`WHERE id = ? AND revision = ?`, and replaces relational waypoints within the same transaction.
A zero-row update is treated as a concurrent-writer conflict; partial waypoint replacement rolls
back.

Reads reconstruct flight rows and relational waypoint order inside one exclusive snapshot
transaction, then revalidate the entire domain object. A 10,001st waypoint sentinel detects
overflow beyond 100 plans by 100 waypoints rather than silently truncating the relation. Owner
mismatches, sequence gaps, duplicate identifiers, malformed coordinates, bad timestamps, or
invalid revisions stop the saved-flight library.

The Plan workspace loads active and archived records together in one separate bounded snapshot
of at most 200 plans and 20,000 waypoints, then splits the validated collection by status. An
archive/restore from another writer therefore cannot make one revision appear in both lists or
neither list during reload.

## Dataset drift

Loading does not trust identifier equality alone. The saved identifier, coordinates, and source
reference must exactly match the active waypoint candidate. A mismatch blocks loading and names
the affected identifiers. This prevents an old route snapshot from silently taking on new
geometry under the same identifier.

## Current limitations

The editor can create, load, duplicate, revise details, replace routes, archive, and restore
drafts. The ephemeral route sequence can move a waypoint up or down through a pure bounded
reorder; every successful reorder clears active-leg selection. Drag editing, arbitrary external
waypoint search, durable alternate/assumption snapshots, Plan selection across the whole shell,
a native date/time picker, outbox sync, richer conflict UI, and native
process-death/visual/accessibility evidence remain open. The included waypoints are fictional
and unverified, so saved routes are not suitable for navigation.
