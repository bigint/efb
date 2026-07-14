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
- cruise speed, fuel capacity and burn, empty and maximum mass, and station arms; and
- optional notes reserved by the persistence model.

Migration v5 adds provenance and revision columns without reinterpreting legacy JSON. Reads
parse both JSON documents and validate the complete profile before exposing any record. One
malformed profile stops the Aircraft library instead of partially trusting stored values. All
inserts use bound SQLite parameters. Reads are capped at 100 active profiles so a corrupted or
unbounded collection cannot create an unbounded mobile render.

## Validation

Identifiers are bounded and normalized, numeric values must be finite and within broad storage
limits, maximum mass cannot be below empty mass, timestamps must be ordered, and unsupported or
implicit unit systems are rejected. Display names reject control characters before they reach
cross-library selectors. Required numeric form fields reject blanks rather than silently
treating them as zero.

## Current limitations

The Aircraft workspace can select a saved profile and calculate total mass, moment, and CG arm
from its entered empty mass and station arms plus user-entered occupant and fuel mass. It
compares total mass with the entered maximum. Fuel stays in kilograms: the profile's litre
capacity is not converted because no fuel type or density source exists.

This summary deliberately returns no envelope result. The UI says `CG ENVELOPE NOT EVALUATED`
until bounded envelope geometry and source/revision provenance are modeled. The separate
built-in polygon sandbox remains fictional.

Profile editing, deletion, selection by a saved flight, envelope authoring, fuel-density
conversion, take-off and landing models, source-document links, and conflict-safe revision
updates remain open. Native persistence recovery and visual/accessibility validation are release
blockers.

Checklist authoring can link a validated local profile UUID and derives the template label from
its normalized registration. This is referential organization only; it does not verify the
profile or checklist content.
