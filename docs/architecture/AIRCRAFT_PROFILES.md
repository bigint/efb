# Aircraft profiles

## Trust boundary

Aircraft profiles are user-entered, local planning notes. Every record is permanently labelled
`unverified`; the current model has no code path for asserting manufacturer, regulator, or
operator approval. Driftline does not bundle aircraft-specific performance figures.

## Durable model

User profiles live in the versioned user SQLite database. A profile records:

- registration, type designator, display name, timestamps, and revision;
- fixed provenance values `user-entered` and `unverified`;
- an explicit units object: kilograms, metres, litres, knots;
- cruise speed, fuel capacity and burn, empty and maximum mass, station arms, and an optional
  user-entered CG polygon of 3 to 20 arm/mass points; and
- optional notes reserved by the persistence model.

Migration v5 adds provenance and revision columns without reinterpreting legacy JSON. Reads
parse both JSON documents and validate the complete profile before exposing any record. One
malformed profile stops the Aircraft library instead of partially trusting stored values. All
inserts use bound SQLite parameters. Reads are capped at 100 active profiles so a corrupted or
unbounded collection cannot create an unbounded mobile render.

User fields can be loaded back into the form and saved as exactly the next profile revision.
Identity, creation time, fixed units, user-entered provenance, and unverified status are
preserved. SQLite updates use `WHERE id = ? AND revision = ?`; a concurrent writer conflict
reloads current storage, clears the stale editor, and does not overwrite the newer record.

## Validation

Identifiers are bounded and normalized, numeric values must be finite and within broad storage
limits, maximum mass cannot be below empty mass, timestamps must be ordered, and unsupported or
implicit unit systems are rejected. Display names reject control characters before they reach
cross-library selectors. Required numeric form fields reject blanks rather than silently
treating them as zero.

Envelope vertices use explicit metres and kilograms and must be entered in perimeter order. The
boundary rejects duplicate points, non-positive mass, zero-area polygons, and intersecting
non-adjacent edges. The generic calculator repeats these geometry checks independently before a
point-in-polygon decision; malformed geometry cannot become a convincing inside result.

## Current limitations

The Aircraft workspace can select a saved profile and calculate total mass, moment, and CG arm
from its entered empty mass and station arms plus user-entered occupant and fuel mass. A
transient scenario may add up to eight labelled mass/arm rows; these rows are parsed with
explicit kilogram and metre bounds, participate in the same moment and CG calculation, and are
cleared when another profile is selected. They are never written to the profile or restored
after process death. The summary compares total mass with the entered maximum. Fuel stays in
kilograms: the profile's litre capacity is not converted because no fuel type or density source
exists.

When the selected profile has no envelope, the summary says `NOT PROVIDED`. When a validated
polygon exists, the same loading calculation reports inside/outside the entered envelope and
continues to label both the data and limits `USER-ENTERED` and `UNVERIFIED`. This is a geometric
decision against user input, not a statement that the polygon came from an approved source. The
separate built-in polygon sandbox remains fictional.

Profile deletion, revision history/rollback, durable loading-station authoring, scenario saving,
envelope graph rendering, fuel-density conversion, take-off and landing models, source-document
links, and editing profile notes remain open. Native persistence recovery and
visual/accessibility validation are release blockers.

Checklist authoring can link a validated local profile UUID and derives the template label from
its normalized registration. This is referential organization only; it does not verify the
profile or checklist content.
