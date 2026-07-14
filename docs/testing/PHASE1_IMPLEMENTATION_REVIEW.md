# Phase 1 implementation review — candidate `e96a2e2`

## Decision

**FAIL — Phase 1 remains open.** Candidate `e96a2e288a61024f50279faae4702f4271c0fce4` passes the
repository's static/unit verification, Expo Doctor, and an iOS JavaScript/Hermes bundle export.
It does not have the native-device, lifecycle-recovery, accessibility, independent-oracle,
performance, or Maestro evidence required by Gate 3. A source-level real/simulated-position
confusion is an automatic release block.

Review scope: independent QA of the candidate commit from a clean isolated checkout. This review
does not approve operational use, a native iOS build, or Phase 1 completion.

## Reproduction environment

- Checkout: `/tmp/efb-qa-review`, branch `agent/qa-review`, candidate HEAD `e96a2e2`.
- Review date: 2026-07-14 (Asia/Kolkata).
- Node: `v22.21.1`; pnpm: `11.9.0`.
- App declares Expo `~57.0.4`, React Native `0.86.0`, and iOS tablet support
  ([`apps/mobile/package.json:17-28`](../../apps/mobile/package.json),
  [`apps/mobile/app.json:7-14`](../../apps/mobile/app.json)).
- Dataset scope is three explicitly fictional, low-confidence, unverified fixtures
  ([`packages/aviation-domain/src/demo-airports.ts:3-16`](../../packages/aviation-domain/src/demo-airports.ts)).
- No frozen OS/device matrix, native build identifier, OTA identity, evidence manifest, SBOM,
  provenance, or dataset-manifest digest was supplied.

## PASS — reproduced checks

| Check                           | Result                                        | Reproduced evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen install                  | PASS                                          | `pnpm install --frozen-lockfile`; 721 packages resolved from the lockfile, exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Repository verification         | PASS                                          | `pnpm verify`; Prettier, ESLint, strict TypeScript across six projects, and Vitest all exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Unit tests                      | PASS, limited scope                           | 4 files / 17 tests pass in 165 ms. The permanent cases are listed in the four `*.test.ts` files; this is not Gate 3 calculation coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Expo Doctor                     | PASS                                          | `pnpm --filter @driftline/mobile doctor`; 20/20 checks pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| iOS JS/Hermes export            | PASS, not a native build                      | `pnpm exec expo export --platform ios --output-dir /tmp/efb-qa-review-export-ios`; 2,058 modules, 26 assets, one 4.9 MB reported bundle, exit 0. Bundle SHA-256: `0ba2e66b9f894a55986a8443953cc1a33defc546ab9141ce4c89384f70a10c2e`. Metadata SHA-256: `231bc77b454020e9c760d35a0761d38a6d35d06c0d11d7e1289b7e6576db06d6`.                                                                                                                                                                                                                                                                                                                      |
| Temporary boundary probes       | PASS, diagnostic only                         | Six non-persisted Vitest probes passed: equatorial antimeridian distance/bearing/cross-track, antimeridian destination wrapping, NaN/infinity rejection, empty/one-point route behavior, duplicate-position leg rejection, and exact-pole output finiteness. The temporary file was removed after execution.                                                                                                                                                                                                                                                                                                                                    |
| Explicit limitations            | PASS by inspection                            | System UI states that the slice is not approved as a primary navigation instrument and names missing data ([`apps/mobile/src/components/SystemWorkspace.tsx:41-55`](../../apps/mobile/src/components/SystemWorkspace.tsx)). Airport fixtures carry source, version, origin, confidence, and verification fields ([`packages/aviation-domain/src/demo-airports.ts:3-16`](../../packages/aviation-domain/src/demo-airports.ts)).                                                                                                                                                                                                                  |
| Basic colour-independent status | PASS by inspection, not an accessibility pass | The top status uses text (`SIMULATION`, `GPS OUTAGE`, or `POSITION STANDBY`) in addition to colour ([`apps/mobile/src/components/StatusPlane.tsx:27-39`](../../apps/mobile/src/components/StatusPlane.tsx)). Shared actions and major navigation controls declare roles/states and 48-point-or-larger minimum heights ([`apps/mobile/src/components/PanelPrimitives.tsx:56-66`](../../apps/mobile/src/components/PanelPrimitives.tsx), [`packages/design-system/src/tokens.ts:32-34`](../../packages/design-system/src/tokens.ts), [`apps/mobile/src/components/WorkspaceRail.tsx:37-61`](../../apps/mobile/src/components/WorkspaceRail.tsx)). |

## FAIL — defects and unmet Gate 3 requirements

### `P0-QA-01` — disabling simulation leaves simulated navigation values visible

The System workspace allows `simulationEnabled` to be set false
([`apps/mobile/src/components/SystemWorkspace.tsx:23-35`](../../apps/mobile/src/components/SystemWorkspace.tsx)).
The map does not read that state: it always derives ownship from the first route/demo fixture
and renders it, and it continues to show hard-coded `118 KT` and `4,500 FT GPS`
([`apps/mobile/src/components/MapWorkspace.tsx:52-90`](../../apps/mobile/src/components/MapWorkspace.tsx),
[`apps/mobile/src/components/MapWorkspace.tsx:147-170`](../../apps/mobile/src/components/MapWorkspace.tsx)).
At the same time the status header labels the source `POSITION STANDBY`, not simulation
([`apps/mobile/src/components/StatusPlane.tsx:33-39`](../../apps/mobile/src/components/StatusPlane.tsx)).

This is real/simulated source confusion and permits convincing frozen values when no position
source is active. The Phase Gate checklist classifies real/simulated source confusion as an
automatic release block
([`docs/testing/PHASE_GATE_CHECKLIST.md:178-189`](./PHASE_GATE_CHECKLIST.md)).

Required disposition: when simulation is off and no validated real source exists, suppress
ownship and every GPS-derived value, expose source/age/accuracy as unavailable, and add
lifecycle and E2E assertions for the transition.

### `P0-QA-02` — process-death/recovery state is neither safe nor verified

Route, selected airport, simulation flag, and workspace are persisted, but GPS outage is omitted
([`apps/mobile/src/store/flight-store.ts:59-68`](../../apps/mobile/src/store/flight-store.ts)).
Thus a process restart can preserve `simulationEnabled: false` while resetting
`gpsOutage: false`, re-exposing the hard-coded values in `P0-QA-01`. The persisted JSON has no
runtime schema, migration function, hydration-error handling, or recovery UI; route/workspace
identifiers are trusted directly
([`apps/mobile/src/store/flight-store.ts:25-31`](../../apps/mobile/src/store/flight-store.ts),
[`apps/mobile/src/store/flight-store.ts:33-70`](../../apps/mobile/src/store/flight-store.ts)).
No corrupt-storage, interrupted edit, background/foreground, or OS-kill tests exist.

Required disposition: define the authoritative source-state model and recovery invariant;
validate/version persisted payloads; fail safe on corrupt or unknown data; and retain
process-kill evidence for route edit, navigation, and simulation.

### `P1-QA-03` — permanent calculation coverage does not satisfy the phase gate

The geospatial suite contains five examples: equatorial degree, cardinal bearings, one round
trip, one track-offset case, and identical-position rejection
([`packages/geospatial/src/great-circle.test.ts:13-43`](../../packages/geospatial/src/great-circle.test.ts)).
The route suite contains three examples
([`packages/flight-planning/src/route.test.ts:8-30`](../../packages/flight-planning/src/route.test.ts)).
There are no permanent property tests, established-library independent oracle, published fixture
tolerances, sequencing implementation/tests, polar policy tests, antimeridian rendering tests,
or malformed-route matrix.

Temporary probes establish only that the current spherical functions produce finite/expected
results for a few extra inputs. They also show that empty and one-point routes return zero
minutes, duplicate-position legs throw, and exact-pole bearings return a finite number. Those
behaviors are not documented as accepted policy. Exact-pole/antipodal bearings need an explicit
undefined-value policy; a finite floating-point result is not evidence of operational meaning.
NaN/infinity are rejected through the branded-unit boundary
([`packages/data-contracts/src/units.ts:13-28`](../../packages/data-contracts/src/units.ts)),
but the permanent suite asserts only NaN metres
([`packages/data-contracts/src/units.test.ts:29-31`](../../packages/data-contracts/src/units.test.ts)).

Required disposition: add golden, boundary, property, metamorphic, and independent-oracle suites
for distance, true bearing, destination, cross-/along-track, route total/time, and waypoint
sequencing, including NaN/infinite, out-of-range, zero-length, antipodal, polar, and
antimeridian cases. Exercise route GeoJSON across the antimeridian; the current UI emits raw
waypoint pairs without a tested/densified geodesic representation
([`apps/mobile/src/components/MapWorkspace.tsx:73-88`](../../apps/mobile/src/components/MapWorkspace.tsx)).

### `P1-QA-04` — GPS trust/degradation contract is incomplete

The slice has no real location adapter and exposes no position timestamp, age, horizontal
accuracy, or changing source identity. GPS outage replaces GS/ALT with dashes but retains the
fixture-position marker, route distance, and ETE
([`apps/mobile/src/components/MapWorkspace.tsx:147-170`](../../apps/mobile/src/components/MapWorkspace.tsx)).
The System status is static fixture text
([`apps/mobile/src/components/SystemWorkspace.tsx:41-47`](../../apps/mobile/src/components/SystemWorkspace.tsx)).
No test proves frozen values cannot look live, source switching is atomic, or simulation cannot
contaminate future real state.

Required disposition: introduce typed timestamp/accuracy/source state, age and stale thresholds,
loss/switch invariants, and structured tests for outage, recovery, stale/out-of-order data, and
real/sim transitions.

### `P1-QA-05` — accessibility acceptance evidence is absent

Source-level accessibility work is partial, but it cannot satisfy the gate. Airport map markers
are visually small padded labels with press handlers and no explicit accessibility label/role or
48-point hit-area evidence
([`apps/mobile/src/components/MapWorkspace.tsx:124-145`](../../apps/mobile/src/components/MapWorkspace.tsx),
[`apps/mobile/src/components/MapWorkspace.tsx:219-221`](../../apps/mobile/src/components/MapWorkspace.tsx)).
Several critical readouts use fixed 8–11 point text, and the main number can shrink through
`adjustsFontSizeToFit`
([`apps/mobile/src/components/MapWorkspace.tsx:206-215`](../../apps/mobile/src/components/MapWorkspace.tsx),
[`apps/mobile/src/components/MapWorkspace.tsx:229-245`](../../apps/mobile/src/components/MapWorkspace.tsx)).
There are no React Native Testing Library tests or retained VoiceOver, Dynamic Type, contrast,
focus/read-order, keyboard/pointer, rotation, split-view, mounted-distance, or turbulence-target
protocols. No supported-user claim can pass from inspection alone.

Required disposition: fix semantic/hit-target gaps, then retain automated and manual evidence on
the declared iPhone/iPad size, orientation, split-width, appearance, and accessibility matrix.

## NOT RUN — required evidence absent

| Required activity                                                            | Status  | Reason / consequence                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native iOS development build                                                 | NOT RUN | Hermes export proves Metro bundling only; no Xcode compile, signing, native module linking, install, or launch was executed.                                                                                                                                                                 |
| iOS Simulator clean-install workflow                                         | NOT RUN | No simulator/device was attached to this review and no retained run was supplied.                                                                                                                                                                                                            |
| Physical iPhone and iPad development builds                                  | NOT RUN | No device/OS/build identity, logs, video, or first-launch result. Android compatibility is likewise unverified.                                                                                                                                                                              |
| Clean install without account/network/location permission                    | NOT RUN | Source appears fixture/offline-oriented, but no native permission/offline protocol was executed.                                                                                                                                                                                             |
| End-to-end airport/search/detail/route/map/persistence/theme/simulation flow | NOT RUN | No React Native integration suite or Maestro files exist in the candidate.                                                                                                                                                                                                                   |
| Required Phase 1 Maestro flows                                               | NOT RUN | No `.maestro` flow, command output, JUnit, screenshots/video, first-attempt record, or fixture-reset proof.                                                                                                                                                                                  |
| Process death and lifecycle recovery                                         | NOT RUN | No native kill-point protocol or corrupt-MMKV fixture; source inspection finds `P0-QA-02`.                                                                                                                                                                                                   |
| VoiceOver, Dynamic Type, rotation, split view, and non-drag alternatives     | NOT RUN | No automated/manual evidence packet or device matrix.                                                                                                                                                                                                                                        |
| Cold launch, airport search, route recalculation, and map frame pacing       | NOT RUN | No release-build signposts, physical-device traces, repetitions, median/p95/worst, or thermal/workload context. `preferredFramesPerSecond={60}` is a request, not a measurement ([`apps/mobile/src/components/MapWorkspace.tsx:93-100`](../../apps/mobile/src/components/MapWorkspace.tsx)). |
| Independent geospatial oracle and properties                                 | NOT RUN | Existing expected values are formula-derived/local examples; no established library/version, fixture source, seeds, shrink records, or tolerance ownership.                                                                                                                                  |
| Route waypoint sequencing                                                    | NOT RUN | No sequencing implementation or tests were found.                                                                                                                                                                                                                                            |

## Gate 3 item disposition

| Gate 3 item                                                                 | Status  | Basis                                                                                                                          |
| --------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Simulator + physical iPhone/iPad development build; Android explicit        | NOT RUN | No native run evidence.                                                                                                        |
| Clean install without account/network/location                              | NOT RUN | No native clean-install protocol.                                                                                              |
| Airport/search/detail/route/display/persistence/theme/simulation end to end | FAIL    | No E2E evidence; persistence/source-state defects `P0-QA-01` and `P0-QA-02`.                                                   |
| Critical calculation suites and independent oracle                          | FAIL    | Minimal example suite; no sequencing, properties, full boundary matrix, or independent oracle.                                 |
| Malformed/out-of-range/NaN/infinite/antimeridian/polar/zero-length policy   | FAIL    | Some constructors fail closed and temporary probes pass, but permanent coverage and accepted polar/route policies are missing. |
| GPS age/accuracy/source/loss and sim isolation                              | FAIL    | No age/accuracy model; simulated values remain visible when simulation is disabled.                                            |
| Process-death safe recovery                                                 | FAIL    | Unsafe asymmetric persistence and no recovery tests.                                                                           |
| Accessibility/layout evidence                                               | NOT RUN | Partial semantics in source; required supported-user/device evidence absent.                                                   |
| Physical-device performance traces                                          | NOT RUN | No measurements or raw traces.                                                                                                 |
| Required Maestro first-attempt flows                                        | NOT RUN | No Maestro assets or results.                                                                                                  |

## Required next gate attempt

1. Resolve `P0-QA-01` and `P0-QA-02` before further Phase 1 approval work.
2. Freeze candidate/native/OTA/dataset identities and the iPhone/iPad/Android matrix in an
   evidence manifest.
3. Land permanent calculation boundary/property/oracle coverage and define polar, antipodal,
   zero-length, empty-route, and sequencing policies.
4. Add integration/Maestro flows for clean offline launch, airport/detail/route/map,
   persistence, day/night, explicit simulation, GPS loss, and process death.
5. Run native simulator plus physical iPhone/iPad builds, accessibility protocols, and measured
   release-build performance with raw retained artifacts.
6. Repeat independent QA and Red Team review. Do not call Phase 1 complete until every Gate 3
   requirement is `PASS` with reproducible evidence.
