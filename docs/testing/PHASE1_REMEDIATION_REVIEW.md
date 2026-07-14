# Phase 1 remediation review — candidate `a449053`

## Decision

**FAIL — remediation is materially improved, but Gate 3 and Phase 1 remain open.** Candidate
`a4490535039e72ca8331c78ee19fc62109104f82` fixes the original normal-path
real/simulated-position confusion, makes incomplete and unresolved routes fail closed, and
strengthens provenance/airport validation. It still has a reproducible corrupt-storage fallback
to enabled simulation and accepts malformed NaN position samples as available. Required native,
physical-device, lifecycle, E2E, accessibility, performance, and independent-oracle evidence is
also absent.

This is an independent source/test remediation decision, not an operational approval, native
build approval, or Phase 1 completion decision.

## Candidate and environment

- Frozen candidate: `a4490535039e72ca8331c78ee19fc62109104f82`, reviewed from isolated
  branch/worktree `agent/qa-review` at `/tmp/efb-qa-review`.
- Review date: 2026-07-14 (Asia/Kolkata).
- Node `v22.21.1`; pnpm `11.9.0`.
- Candidate already contains the first independent QA review and correctly keeps Phase 1 open
  ([`docs/testing/PHASE1_IMPLEMENTATION_REVIEW.md`](./PHASE1_IMPLEMENTATION_REVIEW.md),
  [`docs/status/PROJECT_STATUS.md:3-7`](../status/PROJECT_STATUS.md)).
- The remediation packet itself explicitly leaves native-device, lifecycle, accessibility,
  Maestro, performance, and independent-oracle evidence outstanding
  ([`docs/safety/PHASE1_REMEDIATION_PACKET.md:3-8`](../safety/PHASE1_REMEDIATION_PACKET.md)).

## Reproduced automated results

| Check                               | Status          | Independent result                                                                                                                                                                                                           |
| ----------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`    | PASS            | Nine workspace projects; lockfile accepted; exit 0.                                                                                                                                                                          |
| `pnpm verify`                       | PASS            | Prettier, ESLint, strict TypeScript across eight implementation projects, and Vitest exit 0; 9 files / 44 tests pass in 249 ms.                                                                                              |
| Expo Doctor                         | PASS            | `pnpm --filter @driftline/mobile doctor`; 20/20 checks pass.                                                                                                                                                                 |
| iOS JS/Hermes export                | PASS, limited   | `pnpm exec expo export --platform ios`; 2,059 modules, 26 assets, one 4.9 MB reported Hermes bundle; this is not an Xcode/native build.                                                                                      |
| Temporary recovery/malformed probes | FAIL CLOSED: NO | Three non-persisted Vitest diagnostics confirm that malformed JSON restores enabled simulation, and NaN sample time/accuracy or a NaN current clock are classified `available`. Diagnostic files were removed after the run. |

The first independent export produced bundle SHA-256
`b0d1b302a0931506847acee142ac18593f3b9e3d846196f94d9bfac52c1a8d98`; an immediate second export
from the same candidate/worktree produced
`2bcc50776a435490e9f30a4002fcf0744053e449bddfd2741c6d64729ad656a0`. Both metadata files were
identical at `e284b15969af248a9e42f94b8a910d3a828f0cefeca2a5c0266a0e4edb12ee60`. The packet
records a third bundle hash
([`docs/safety/PHASE1_REMEDIATION_PACKET.md:27-36`](../safety/PHASE1_REMEDIATION_PACKET.md)).
The export command is repeatably successful, but its HBC artifact is not byte-reproducible under
this protocol; no specific JS artifact can be treated as the frozen candidate without a retained
artifact/build identity.

## Fixed or materially improved

### Prior `P0-QA-01`: normal real/simulation state transition — **FIXED IN SOURCE**

- Position scenario, sample, origin, age, and freshness are evaluated through one fail-closed
  function; disabled, outage, missing, future-clock, and stale scenarios return unavailable
  ([`apps/mobile/src/domain/position-source.ts:11-43`](../../apps/mobile/src/domain/position-source.ts),
  [`apps/mobile/src/domain/position-source.test.ts:15-35`](../../apps/mobile/src/domain/position-source.test.ts)).
- Disabling simulation atomically clears the sample and changes the scenario to `disabled`; an
  outage clears the sample
  ([`apps/mobile/src/store/flight-store.ts:72-109`](../../apps/mobile/src/store/flight-store.ts)).
- Map ownship now exists only for an available evaluated sample, and GS/ALT read from that
  sample or display dashes. Both values explicitly say `SIM`
  ([`apps/mobile/src/components/MapWorkspace.tsx:53-102`](../../apps/mobile/src/components/MapWorkspace.tsx),
  [`apps/mobile/src/components/MapWorkspace.tsx:162-205`](../../apps/mobile/src/components/MapWorkspace.tsx)).
- Header/System status use the same evaluation and show source, accuracy, age, or an unavailable
  reason in text
  ([`apps/mobile/src/components/StatusPlane.tsx:8-22`](../../apps/mobile/src/components/StatusPlane.tsx),
  [`apps/mobile/src/components/SystemWorkspace.tsx:10-18`](../../apps/mobile/src/components/SystemWorkspace.tsx),
  [`apps/mobile/src/components/SystemWorkspace.tsx:45-56`](../../apps/mobile/src/components/SystemWorkspace.tsx)).

This closes the source-level path where disabling simulation left fixture ownship and invented
GPS values visible. Native transition and lifecycle evidence remains `NOT RUN`.

### Prior `P0-QA-02`: persistence/recovery — **PARTIALLY FIXED**

- The atomic position scenario, including outage state, is persisted while transient samples are
  excluded; every rehydrated sample starts null
  ([`apps/mobile/src/store/flight-store.ts:113-129`](../../apps/mobile/src/store/flight-store.ts)).
- A strict Zod schema validates the deserialized state. Schema-invalid state merges to disabled
  simulation and a null sample
  ([`apps/mobile/src/store/flight-store.ts:29-39`](../../apps/mobile/src/store/flight-store.ts),
  [`apps/mobile/src/store/flight-store.ts:113-119`](../../apps/mobile/src/store/flight-store.ts)).

These controls fix the prior asymmetric `simulationEnabled`/`gpsOutage` persistence. They do not
cover malformed serialized JSON or semantically invalid routes; see `P1-RR-01` and `P1-RR-03`.
No OS process-death, background/foreground, interrupted-write, or corrupt-MMKV device protocol
has run.

### Route state and resolution — **FIXED FOR REVIEWED CASES**

- Empty/one-waypoint routes now return explicit `empty`/`incomplete` states with null distance
  and ETE, rather than invented zero totals
  ([`packages/flight-planning/src/route.ts:21-26`](../../packages/flight-planning/src/route.ts),
  [`packages/flight-planning/src/route.ts:64-70`](../../packages/flight-planning/src/route.ts),
  [`packages/flight-planning/src/route.test.ts:28-41`](../../packages/flight-planning/src/route.test.ts)).
- Unknown persisted identifiers are preserved, reported, and block all route calculation instead
  of silently shortening the route
  ([`packages/flight-planning/src/route.ts:28-49`](../../packages/flight-planning/src/route.ts),
  [`packages/flight-planning/src/route.test.ts:48-53`](../../packages/flight-planning/src/route.test.ts),
  [`apps/mobile/src/components/PlanWorkspace.tsx:68-79`](../../apps/mobile/src/components/PlanWorkspace.tsx)).
- Map ownship is independent from the first route waypoint
  ([`apps/mobile/src/components/MapWorkspace.tsx:61-102`](../../apps/mobile/src/components/MapWorkspace.tsx)).
- A permanent antimeridian distance case and 800 fast-check property runs were added
  ([`packages/geospatial/src/great-circle.property.test.ts:9-57`](../../packages/geospatial/src/great-circle.property.test.ts)).

### Provenance and airport adapter — **FIXED FOR REVIEWED CASES**

- Unknown/unbounded provenance is no longer treated as current. Currency is explicit as current,
  expired, invalid, not-effective, or unknown, with invalid clock handling
  ([`packages/data-contracts/src/confidence.ts:30-43`](../../packages/data-contracts/src/confidence.ts),
  [`packages/data-contracts/src/confidence.test.ts:18-47`](../../packages/data-contracts/src/confidence.test.ts)).
- Airport ingestion rejects invalid provenance, malformed identifier casing, invalid IANA
  timezones, and duplicate runway designators
  ([`packages/aviation-domain/src/airport.ts:25-68`](../../packages/aviation-domain/src/airport.ts),
  [`packages/aviation-domain/src/airport.test.ts:30-74`](../../packages/aviation-domain/src/airport.test.ts)).

Chronology consistency (for example, effective time after expiry), runway reciprocal/heading
semantics, and operational-bound policies remain outside this remediation.

### Source-level accessibility changes — **IMPROVED, NOT APPROVED**

Map airport markers now declare button semantics and labels and use 48-point minimum dimensions
([`apps/mobile/src/components/MapWorkspace.tsx:136-160`](../../apps/mobile/src/components/MapWorkspace.tsx),
[`apps/mobile/src/components/MapWorkspace.tsx:254-265`](../../apps/mobile/src/components/MapWorkspace.tsx)).
This addresses the specific marker source issue from the first review. It does not replace
VoiceOver, Dynamic Type, contrast, focus order, rotation, split-view, keyboard/pointer, or
physical touch-target evidence.

## Remaining source/test defects

### `P1-RR-01` — malformed persisted JSON enables simulation instead of failing disabled

The strict merge schema runs only after JSON deserialization. The store uses Zustand
`createJSONStorage` and has no hydration-error callback/recovery state
([`apps/mobile/src/store/flight-store.ts:41-47`](../../apps/mobile/src/store/flight-store.ts),
[`apps/mobile/src/store/flight-store.ts:112-129`](../../apps/mobile/src/store/flight-store.ts)).
A non-persisted diagnostic mocked MMKV `getString()` returning malformed JSON. Hydration
bypassed `merge`, and the resulting state was the initializer's
`{ gpsAvailable: true, kind: 'simulated' }`
([`apps/mobile/src/store/flight-store.ts:51-62`](../../apps/mobile/src/store/flight-store.ts)).

This contradicts the packet claim that corrupt persisted state fails disabled and leaves a
corruption path that activates simulated position without a recovered user choice. Required fix:
handle raw read/parse/version/hydration failures explicitly, clear or quarantine corrupt state,
force disabled/no-sample, expose remediation, and retain corrupt-MMKV/process-death evidence.

### `P1-RR-02` — malformed NaN position inputs are classified available

`evaluatePosition` validates only scenario, sample presence, and age comparisons. It does not
validate finite `now`, sample time, coordinates, altitude, groundspeed, or accuracy
([`apps/mobile/src/domain/position-source.ts:30-43`](../../apps/mobile/src/domain/position-source.ts)).
Temporary probes supplied NaN `sampledAt`/accuracy and separately a NaN current clock; both
returned `kind: 'available'`. The UI would then expose `NaN` age/accuracy while rendering the
sample's other values. The permanent test covers a negative age but not NaN/infinite or
malformed sample fields
([`apps/mobile/src/domain/position-source.test.ts:27-35`](../../apps/mobile/src/domain/position-source.test.ts)).

Required fix: validate a runtime sample schema and finite clock before any freshness comparison,
then add NaN/infinite/out-of-range fixtures for every position field.

### `P1-RR-03` — schema-valid duplicate persisted routes can crash rendering

The persistence schema bounds identifier strings and array length but does not require unique or
currently resolvable identifiers
([`apps/mobile/src/store/flight-store.ts:29-39`](../../apps/mobile/src/store/flight-store.ts)).
Unresolved identifiers are safely blocked, but duplicate valid identifiers resolve and are then
rejected by `calculateRoute` with a thrown `RangeError`
([`packages/flight-planning/src/route.ts:32-49`](../../packages/flight-planning/src/route.ts),
[`packages/flight-planning/src/route.ts:51-62`](../../packages/flight-planning/src/route.ts)).
Map and Plan call this calculation during render without a recovery boundary
([`apps/mobile/src/components/MapWorkspace.tsx:61-84`](../../apps/mobile/src/components/MapWorkspace.tsx),
[`apps/mobile/src/components/PlanWorkspace.tsx:21-36`](../../apps/mobile/src/components/PlanWorkspace.tsx)).

This fails safely against incorrect output but does not recover safely after corruption/process
death. Required fix: validate semantic persisted-route invariants or return a typed blocked
result instead of throwing from a render path, with corrupt/legacy persistence tests.

### Calculation gate remains incomplete

Property and antimeridian coverage are a meaningful improvement, but there is still no
established-library independent oracle, polar/antipodal policy suite, track-offset properties,
route GeoJSON antimeridian rendering evidence, or waypoint sequencing implementation/tests. The
property suite explicitly excludes polar singularities
([`packages/geospatial/src/great-circle.property.test.ts:13-16`](../../packages/geospatial/src/great-circle.property.test.ts),
[`packages/geospatial/src/great-circle.property.test.ts:34-50`](../../packages/geospatial/src/great-circle.property.test.ts)).
Gate 3's calculation requirement therefore remains `FAIL`, not partially inferred `PASS`.

## Required evidence still NOT RUN

| Gate evidence                        | Status  | What is missing                                                                                                                                                   |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native iOS development build         | NOT RUN | Hermes export does not compile/link/install MapLibre, Skia, MMKV, sensors, or other native modules through Xcode.                                                 |
| iOS Simulator clean install          | NOT RUN | No frozen native build identity, simulator/OS log, permission-denial flow, or first-launch artifact.                                                              |
| Physical iPhone and iPad builds      | NOT RUN | No device/OS matrix, install/launch evidence, logs, or video. Android compatibility is also unverified.                                                           |
| Process death and lifecycle recovery | NOT RUN | No OS kill/background/foreground, corrupt MMKV, interrupted write, or before/after state evidence.                                                                |
| Maestro E2E                          | NOT RUN | No Maestro flows, command/version, JUnit, first-attempt result, reset proof, screenshots, or video.                                                               |
| Accessibility acceptance             | NOT RUN | No VoiceOver, Dynamic Type, contrast, focus/read order, non-drag, keyboard/pointer, rotation, split-view, or turbulence-target protocol.                          |
| Physical-device performance          | NOT RUN | No cold-launch, airport-search, route-recalculation, or map frame trace with release build, device, workload, repetitions, median/p95/worst, and thermal context. |
| Independent calculation oracle       | NOT RUN | Fast-check uses the implementation's own destination/distance/bearing round trip; no established external library/version or retained oracle fixtures.            |
| Route sequencing                     | NOT RUN | No sequencing implementation or test suite.                                                                                                                       |

## Gate 3 disposition

| Gate 3 requirement                                                   | Decision                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Native simulator and physical iPhone/iPad development builds         | NOT RUN                                                                                                              |
| Clean offline/permission-denied install                              | NOT RUN                                                                                                              |
| Airport/search/detail/route/display/persistence/theme/simulation E2E | FAIL — source flows improved, but persistence defects remain and E2E is absent.                                      |
| Critical calculation suites and independent oracle                   | FAIL — properties added; oracle, polar/full boundary, sequencing, and rendering coverage missing.                    |
| Malformed/NaN/infinite/antimeridian/polar/zero-length policy         | FAIL — antimeridian and route boundaries improved; malformed position probes still fail open.                        |
| GPS age/accuracy/source/loss and simulation isolation                | FAIL — normal-path source model fixed; malformed position and corrupt persistence paths remain.                      |
| Process-death safe recovery                                          | FAIL — schema-invalid payload handling improved; raw corruption/semantic-route recovery and native evidence missing. |
| Accessibility/layout evidence                                        | NOT RUN                                                                                                              |
| Physical-device performance traces                                   | NOT RUN                                                                                                              |
| Required Maestro first-attempt flows                                 | NOT RUN                                                                                                              |

## Required next action

1. Fix `P1-RR-01`, `P1-RR-02`, and `P1-RR-03`, and add permanent recovery/malformed tests.
2. Freeze and retain one identified native candidate and evidence manifest; investigate or
   account for non-reproducible HBC bytes rather than using an unbound bundle hash as candidate
   identity.
3. Complete the independent calculation oracle, polar/antipodal/cross-track/sequencing matrices,
   and route-rendering checks.
4. Run simulator and physical iPhone/iPad clean-install, lifecycle/process-death, Maestro,
   accessibility, and performance protocols with raw retained artifacts.
5. Repeat independent QA and Red Team review. Do not call Phase 1 complete until all Gate 3
   items are `PASS` with reproducible evidence.
