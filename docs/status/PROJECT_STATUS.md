# Project status

## Current phase

Phase 0 foundations are materially established. A Phase 1 development vertical slice exists, but
Phase 1 remains open pending native-device, accessibility, persistence-recovery, and independent
safety evidence.

## Safety status

No release is approved for operational navigation. The mobile app bundles three fictional,
explicitly unverified demonstration airports and a generic educational aircraft profile. It
contains no authoritative charts, weather, NOTAM, terrain, obstacle, or certified aircraft
performance data.

## Active workstreams

- Native iOS/Android device-position and physical-device validation
- SQLite user/control database and immutable dataset-generation registry
- Simulator accuracy degradation and native lifecycle recovery
- Property/golden coverage for antimeridian, polar, zero-length, and malformed calculations
- Accessibility, split-view, performance, battery, and process-death evidence
- U.S. source-ingestion proof without redistribution while written data rights are clarified

## Verification

- pnpm workspace and frozen lockfile are present.
- Expo Doctor: 20/20 checks passed on 2026-07-14 after the safety-remediation changes.
- Strict TypeScript: passed across nine implementation packages/apps.
- ESLint and Prettier: passed.
- Unit tests: 220 passed across thirty-three test files.
- iOS production JavaScript/Hermes bundle export passed on 2026-07-14 (2,163 modules, 5.5 MB
  uncompressed bundle artifact); native simulator and physical builds are not yet recorded.
- The first remediation candidate adds an atomic fail-closed simulated position source, route
  resolution blocking, explicit data-currency classification, semantic airport validation, and a
  generic typed weight-and-balance core. Independent re-review keeps Phase 1 blocked.
- Independent QA found malformed-JSON, non-finite-position, and duplicate-route recovery
  defects; all three now have fail-closed boundaries, permanent regression tests, and an
  independent targeted closure review.
- A conservative METAR/SPECI adapter now preserves raw/provenance data, explicit visibility
  bounds, observation time, and unsupported body groups. An offline manual decoder labels all
  input unverified and currency-unknown. An on-demand AWC client retrieves one bounded raw METAR
  with a one-minute request interval, provider/station validation, source provenance, and
  currency evaluation. The same client retrieves one bounded raw TAF with station binding and a
  shared request gate, but does not decode forecast groups or evaluate validity. Offline cache,
  native network QA, and briefing completeness remain open.
- A typed true-reference wind triangle returns heading, signed correction, and groundspeed or an
  explicit no-solution state. Route legs can now produce wind-adjusted ETE or identify the
  blocking leg, and Plan exposes a clearly labelled constant-wind sandbox. Winds-aloft sourcing
  and a durable plan-assumptions model remain open.
- Separate versioned user and control SQLite schemas now migrate before app render. Executable
  schema tests enforce key relational constraints, and the pure offline-region lifecycle keeps
  active data independent from update failure while rejecting cross-attempt, incomplete,
  wrong-region, invalid-time, and unauthorized-rollback transitions. Filesystem, signature, and
  atomic activation adapters remain open. A read-only System manager now cross-checks active
  pointers, manifests, file metadata, and recent attempts before reporting registry state, while
  explicitly stating that filesystem contents have not been rehashed.
- A local Records workspace now writes validated logbook entries through parameterized SQLite
  transactions and labels regulatory compliance as unevaluated. An atomic dashboard bounds the
  rendered page to 100 validated recent entries and 2,000 attachment relations while validating
  constant-memory all-time SQLite aggregates. Migration v2 preserves v1 rows and moves
  attachments to relational references; a database failure stops the normal shell. Native
  recovery and visual/accessibility QA remain open. Saved aircraft references and up to 20
  document attachments are selectable; their libraries fail independently so corrupt reference
  metadata does not hide valid entries. React Native Web is not a usable visual-QA surface
  because the current MapLibre native module fails its web codegen boundary before render.
- The Library now supports user-authored normal, abnormal, and emergency-labelled checklist
  templates without bundling aircraft procedures. Active runs retain immutable revision
  snapshots and use compare-and-swap state revisions for atomic completion updates. Templates
  can link validated local aircraft profiles. Migration v6 adds immutable abandonment history
  and a database-level one-open-run constraint. Every surface remains unverified; native
  concurrency, recovery, and accessibility evidence are open.
- PDF-only document import now validates UUID paths, MIME and bounded container markers; copies
  into app-private storage; verifies SHA-256 after the copy; and persists revalidated metadata
  and bookmark relations. The reader is explicitly disabled pending native malformed-file,
  accessibility, memory, and offline QA. A non-destructive private-storage audit reports
  missing, changed-size, misplaced, and unregistered entries without deleting bytes or rehashing
  on every load. Favourite, folder, and manual bookmark metadata can be edited with validated
  labels and conflict-aware writes without enabling the reader.
- The development simulator now advances a constant 118-knot profile on an explicitly true
  068-degree great-circle track. Updates are bounded to five-second ticks, longer lifecycle gaps
  pause in place, and invalid time or track data fails closed. Native timer, lifecycle, and
  physical-device behavior remain unverified.
- User-entered aircraft profiles now persist locally with explicit kilogram, metre, litre, and
  knot units, immutable unverified provenance, schema revision, parameterized writes, and a
  fail-closed JSON read boundary. User fields can advance through compare-and-swap revisions
  while identity, units, provenance, and unverified status stay fixed. The fictional loading
  sandbox remains separate; approved source linking, revision history, envelope authoring, and
  native recovery are open. A selected profile can calculate mass, moment, CG arm, and entered
  maximum-mass status, while explicitly withholding any CG-envelope decision.
- An explicit user action can now select a foreground-only device-location source. Permission,
  service, provider-error, null-telemetry, and stale-sample states fail closed; metric provider
  values convert to cockpit units at a pure boundary, and source changes clear prior samples.
  Native permission, lifecycle, accuracy, energy, and physical-device evidence remain open.
- Dedicated high-contrast day and night palettes follow iOS Increase Contrast and Android High
  contrast text, including live setting-change subscriptions. Automated token checks enforce
  documented semantic contrast thresholds, and the demonstration map uses the selected palette.
  Native rendering, accessibility-tree, glare, and dark-adaptation evidence remain open.
- Resolved demonstration routes can now be saved and loaded through transactional SQLite flight
  and waypoint records. Reads reconstruct and revalidate ordered snapshots, future updates use a
  compare-and-swap revision, and loading blocks if coordinates or dataset source references have
  drifted. Drafts can link aircraft profiles, rename, replace route snapshots after
  confirmation, archive, and restore through compare-and-swap revisions. One detail editor can
  revise title, aircraft assignment, whole-foot cruise altitude, explicit UTC departure time,
  and notes atomically. MMKV no longer claims route durability; a native date/time picker and
  richer conflict UI remain open.
- Phase 1 gate remains open; no performance or operational-readiness claim is made.

## Last updated

2026-07-14
