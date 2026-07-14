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

- Native iOS/Android development-build and physical-device validation
- SQLite user/control database and immutable dataset-generation registry
- Simulator movement, accuracy degradation, and native lifecycle recovery
- Property/golden coverage for antimeridian, polar, zero-length, and malformed calculations
- Accessibility, split-view, performance, battery, and process-death evidence
- U.S. source-ingestion proof without redistribution while written data rights are clarified

## Verification

- pnpm workspace and frozen lockfile are present.
- Expo Doctor: 20/20 checks passed on 2026-07-14 after the safety-remediation changes.
- Strict TypeScript: passed across nine implementation packages/apps.
- ESLint and Prettier: passed.
- Unit tests: 121 passed across eighteen test files.
- iOS production JavaScript/Hermes bundle export passed on 2026-07-14 (2,117 modules, 5.2 MB
  uncompressed bundle artifact); native simulator and physical builds are not yet recorded.
- The first remediation candidate adds an atomic fail-closed simulated position source, route
  resolution blocking, explicit data-currency classification, semantic airport validation, and a
  generic typed weight-and-balance core. Independent re-review keeps Phase 1 blocked.
- Independent QA found malformed-JSON, non-finite-position, and duplicate-route recovery
  defects; all three now have fail-closed boundaries, permanent regression tests, and an
  independent targeted closure review.
- A conservative METAR/SPECI adapter now preserves raw/provenance data, explicit visibility
  bounds, observation time, and unsupported body groups. An offline manual decoder labels all
  input unverified and currency-unknown; live retrieval, TAF, and briefing remain open.
- A typed true-reference wind triangle returns heading, signed correction, and groundspeed or an
  explicit no-solution state. Route legs can now produce wind-adjusted ETE or identify the
  blocking leg, and Plan exposes a clearly labelled constant-wind sandbox. Winds-aloft sourcing
  and a durable plan-assumptions model remain open.
- Separate versioned user and control SQLite schemas now migrate before app render. Executable
  schema tests enforce key relational constraints, and the pure offline-region lifecycle keeps
  active data independent from update failure while rejecting cross-attempt, incomplete,
  wrong-region, invalid-time, and unauthorized-rollback transitions. Filesystem, signature, and
  atomic activation adapters remain open.
- A local Records workspace now writes validated logbook entries through parameterized SQLite
  transactions, restores and revalidates them for totals, and labels regulatory compliance as
  unevaluated. Migration v2 preserves v1 rows and moves attachments to relational references; a
  database failure stops the normal shell. Native recovery and visual/accessibility QA remain
  open. React Native Web is not a usable visual-QA surface because the current MapLibre native
  module fails its web codegen boundary before render.
- Phase 1 gate remains open; no performance or operational-readiness claim is made.

## Last updated

2026-07-14
