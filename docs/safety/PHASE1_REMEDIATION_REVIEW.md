# Phase 1 safety remediation re-review

## Candidate and decision

**Frozen candidate:** `a449053`

**Decision: BLOCK Phase 1 closure; accept the code remediation as a materially safer internal
demonstration candidate.**

The previously identified critical path in which simulation could be switched off while
fabricated navigation output remained visible is closed in the reviewed source. Empty/incomplete
routes, unresolved persisted waypoints, unavailable position, data currency, and the unsupported
`NEAREST` claim also fail more safely.

This source-level improvement does not supply the native simulator, physical-device, lifecycle,
accessibility, Maestro, performance, or independent calculation-oracle evidence required by the
Phase 1 gate. H-006, H-007, H-010, and H-012 also remain materially open in code or
verification. The candidate therefore remains unsuitable for operational navigation and cannot
close Phase 1.

## Review method

- Rebased the isolated `agent/red-team` worktree onto candidate `a449053` without modifying
  main.
- Re-read H-001 through H-012 in `HAZARD_LOG.md` and every claim in
  `PHASE1_REMEDIATION_PACKET.md`.
- Inspected the position state/evaluator, persistence merge, simulation clock, map/status/System
  consumers, route calculation/resolution and UI, provenance classification, airport adapter,
  runway presentation, and associated tests.
- Searched for source divergence, `Date.now`/lifecycle behavior, route filtering, true/magnetic
  handling, precision labels, stale-data use, and unsupported controls.
- Ran `pnpm verify` successfully: formatting, lint, strict TypeScript across eight
  implementation projects, and 44 tests across 9 files passed.
- Did not infer native or human-factors behavior from passing TypeScript/unit tests.

## Hazard disposition matrix

| Hazard | Code disposition       | Evidence disposition                | Re-review conclusion                                                 |
| ------ | ---------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| H-001  | Remediated             | Native transitions remain open      | Critical static path closed; milestone evidence open                 |
| H-002  | Partially remediated   | Lifecycle/device evidence open      | Freshness boundary exists; full source/lifecycle contract not proven |
| H-003  | Remediated for demo    | Screenshot/VoiceOver evidence open  | Unsupported direction/rings removed                                  |
| H-004  | Remediated             | Mobile UI automation open           | 0/1 routes no longer invent totals or ownship                        |
| H-005  | Partially remediated   | Chronology/UI corpus open           | Unknown/invalid fail safer; chronology semantics incomplete          |
| H-006  | Partially remediated   | Malformed-data corpus incomplete    | Several semantic checks added; cross-field policies remain open      |
| H-007  | Partially remediated   | Magnetic oracle/model absent        | `°T` is explicit; type/model separation remains open                 |
| H-008  | Remediated             | Native smoke test open              | Unsupported claim removed from source                                |
| H-009  | Remediated at core/UI  | Persistence/process-death flow open | Unresolved intent is retained and blocks output                      |
| H-010  | Partially remediated   | Units/precision matrix open         | Simulation units explicit; provenance precision policy absent        |
| H-011  | Contained, not removed | Native map/fallback evidence open   | Acceptable only for supervised internal demo                         |
| H-012  | Improved, still open   | Required suites/artifacts absent    | Static suite is broader but gate remains blocked                     |

## Detailed re-review

### H-001 — Simulation/source confusion

**Code status: remediated. Evidence status: open.**

The store now uses a discriminated position scenario and clears `positionSample` whenever
simulation is disabled (`apps/mobile/src/store/flight-store.ts:12-26,81-87`). `evaluatePosition`
returns `no-active-source` before considering a sample
(`apps/mobile/src/domain/position-source.ts:30-43`). Map ownship, GS, and ALT all require an
available evaluation (`apps/mobile/src/components/MapWorkspace.tsx:61,101,162-165,180-196`),
while Status and System derive their wording from the same evaluator
(`apps/mobile/src/components/StatusPlane.tsx:10-22`,
`apps/mobile/src/components/SystemWorkspace.tsx:12-18,49-55`).

The old contradictory static path is no longer present. Closure evidence still requires a native
transition matrix proving toggle, hydration, background/foreground, process death, and rapid
source-state changes cannot briefly expose a stale sample.

### H-002 — Position age, accuracy, source, and loss

**Code status: partially remediated. Evidence status: open and release-blocking.**

The simulated sample now carries sampled time, horizontal accuracy, speed, altitude, and a
deliberately unavailable track; the available evaluation labels its origin as simulated
(`apps/mobile/src/domain/position-source.ts:1-25`). Evaluation fails closed for outage, missing
sample, future/invalid clock relationship, and samples older than 3 seconds
(`apps/mobile/src/domain/position-source.ts:28-43`). Position samples are not persisted; corrupt
persisted state hydrates to disabled with no sample
(`apps/mobile/src/store/flight-store.ts:113-128`). The root simulation clock refreshes the
sample once per second (`apps/mobile/app/_layout.tsx:19-24`). Boundary tests cover the principal
evaluator states (`apps/mobile/src/domain/position-source.test.ts:15-35`).

Remaining gaps are material: freshness relies on wall clock rather than monotonic receipt time;
the exact 3,000 ms boundary is untested; there is no background/AppState policy; vertical
accuracy, permission/provider state, device GPS, and external-source handover do not exist.
Those omissions are acceptable only because the candidate is simulation-only, not as Phase 1
lifecycle evidence.

### H-003 — Ownship direction and false precision

**Code status: remediated for current demo. Evidence status: open.**

Ownship is now independent of route endpoints and appears only for an available sample
(`apps/mobile/src/components/MapWorkspace.tsx:101,162-165`). The glyph is a non-directional
diamond without accuracy rings, and its accessibility label explicitly says track and heading
are unavailable (`apps/mobile/src/components/OwnshipGlyph.tsx:4-12`). The header exposes
simulated origin and ±50 m accuracy (`apps/mobile/src/components/StatusPlane.tsx:15-22`).

Native MapLibre/Skia screenshots at different rotations and zooms plus VoiceOver output are
still needed to prove the glyph is perceived as non-directional and the source/accuracy context
remains visible.

### H-004 — Empty and one-waypoint route output

**Code status: remediated. Evidence status: UI automation open.**

`calculateRoute` now returns explicit `empty`/`incomplete` states with null distance and ETE for
fewer than two waypoints (`packages/flight-planning/src/route.ts:21-25,64-70`), with
deterministic tests for both (`packages/flight-planning/src/route.test.ts:28-41`). Plan displays
unavailable distance/ETE plus route state
(`apps/mobile/src/components/PlanWorkspace.tsx:43-65`); Map displays dashes and `NO ROUTE`
(`apps/mobile/src/components/MapWorkspace.tsx:197-206`). Position comes only from the evaluated
sample, not a waypoint.

Native UI tests should still verify empty, one-point, two-point, and repeated-position failure
states, including screen-reader wording. The code-level hazard is closed.

### H-005 — Unknown/invalid/stale provenance

**Code status: partially remediated. Evidence status: open.**

Currency now distinguishes current, expired, invalid, not-effective, and unknown; missing bounds
are unknown and `isStale` treats every non-current state as stale
(`packages/data-contracts/src/confidence.ts:30-43`). Tests cover bounded intervals, null bounds,
future effective time, invalid verification, invalid clock, and expiry equality
(`packages/data-contracts/src/confidence.test.ts:18-47`). Invalid provenance is rejected at the
airport adapter (`packages/aviation-domain/src/airport.ts:40-47`), and Places exposes dataset,
verification, confidence, and currency
(`apps/mobile/src/components/PlacesWorkspace.tsx:98-110`).

The packet correctly labels this partial. The classifier does not reject contradictory
chronology such as expiry before effective time, has no near-expiry state, and can classify
time-bounded but unverified data as current while verification is presented separately.
Per-product currency policy and dominant invalid/unknown UI tests remain open.

### H-006 — Malformed airport/runway data

**Code status: partially remediated. Evidence status: open and release-blocking for real data.**

The adapter now enforces canonical uppercase airport/IATA patterns, valid IANA timezone, unique
runway designators, and rejection of invalid provenance
(`packages/aviation-domain/src/airport.ts:25-68`). Tests exercise each new category
(`packages/aviation-domain/src/airport.test.ts:30-74`).

It still accepts runway designator/heading contradictions, arbitrary surface strings,
implausible but positive runway dimensions, arbitrary finite elevation, and
duplicate/conflicting airport records at dataset level. It has no reciprocal-runway or
jurisdiction policy. This remains a code blocker before external airport ingestion can satisfy
Phase 1.

### H-007 — True versus magnetic reference

**Code status: partially remediated. Evidence status: open and release-blocking.**

The current runway detail now labels the stored heading explicitly as `°T`
(`apps/mobile/src/components/PlacesWorkspace.tsx:115-127`), which closes the immediate unlabeled
display problem. Route and runway values still use the generic `Degrees`/number representation
(`packages/flight-planning/src/route.ts:14-18`,
`packages/aviation-domain/src/airport.ts:70-75`). There are no separate true/magnetic types,
magnetic-variation model/epoch/source, conversion unavailable state, or independent magnetic
oracle. H-007 remains open for the Phase 1 bearing contract and for any magnetic output.

### H-008 — Unsupported `NEAREST` claim

**Code status: remediated. Evidence status: native smoke test open.**

The control is now labelled `PLACES` and performs exactly that navigation
(`apps/mobile/src/components/MapWorkspace.tsx:208-218`). No proximity or emergency-workflow
claim remains in the reviewed UI source.

### H-009 — Silently shortened persisted routes

**Code status: remediated at core and source UI. Evidence status: open.**

Resolution now returns the complete ordered route or an explicit unresolved list; it never
returns a shortened partial route (`packages/flight-planning/src/route.ts:28-49`). A unit test
preserves a missing intermediate identifier
(`packages/flight-planning/src/route.test.ts:48-53`). Plan retains unresolved identifiers, marks
calculation `BLOCKED`, and displays remediation text
(`apps/mobile/src/components/PlanWorkspace.tsx:21-36,59-79,92-115`). Map calculates no partial
route and shows `ROUTE BLOCKED` with the unresolved identifiers
(`apps/mobile/src/components/MapWorkspace.tsx:62-84,169-178`).

Persisted-storage migration, dataset replacement, corruption, process death, and UI automation
are still required. Dataset-level duplicate available identifiers are also not rejected by
`resolveRouteIdentifiers` because its `Map` silently selects the last record; real dataset
activation must prevent that ambiguity.

### H-010 — Units and evidence-based precision

**Code status: partially remediated. Evidence status: open.**

GS and altitude now say `KT SIM` and `FT SIM`; route quantities say `NM ROUTE`/`MIN ROUTE`
(`apps/mobile/src/components/MapWorkspace.tsx:180-206`). Runway heading says `°T`, and
unavailable route quantities are no longer numeric zero. However, airport coordinates still
render to four decimal places despite low/unverified provenance and without datum or uncertainty
(`apps/mobile/src/components/PlacesWorkspace.tsx:98-109`). Position and bearing semantics still
reuse generic degrees/runtime numbers. Provenance-driven rounding and the units/altitude/north-
reference matrix remain open.

### H-011 — Map/chart authority implication

**Code status: contained, not removed. Evidence status: open.**

`OFFLINE DEMO GRID` and `No chart data loaded` remain at point of use, and unresolved routes
replace that text with a dominant block (`apps/mobile/src/components/MapWorkspace.tsx:169-178`).
System continues to state that chart, weather, NOTAM, obstacle, and terrain data are absent
(`apps/mobile/src/components/SystemWorkspace.tsx:45-64`). This is a reasonable containment for a
supervised internal demo, not evidence that blank-map failures are safe on native devices.

Rotation, split view, zoom, screenshot cropping, VoiceOver, map renderer failure/fallback, and
warning occlusion still need native evidence. H-011 remains a block for any operational or
situational-awareness distribution, but not for controlled internal demonstration.

### H-012 — Verification sufficiency

**Code status: improved, not remediated. Evidence status: open and release-blocking.**

The automated suite grew from 17 tests in 4 files to 44 tests in 9 files and now covers position
evaluation, route nullability/resolution, provenance currency, airport semantic checks,
geospatial properties, dataset activation, and generic weight/balance boundaries. The
independently reproduced `pnpm verify` run is green.

Still absent are mobile component/state integration tests, Maestro flows, native simulator and
physical-device runs, VoiceOver/Dynamic Type/rotation/split-view results, process-death and
background tests, permission/sensor injection, performance traces, and independent geodesic and
magnetic calculation oracles. A JavaScript export and Expo Doctor result in the remediation
packet do not substitute for those artifacts. H-012 remains open.

## Remediation packet accuracy

`PHASE1_REMEDIATION_PACKET.md` is materially accurate and appropriately says it does not close
Phase 1. Its “remediated” claims are accepted only at the source/core-test level described
above. The following qualifications must remain attached:

- H-002 uses wall-clock freshness and has no native lifecycle/source-switch evidence.
- H-005 lacks contradictory-chronology and per-product verification/currency policy.
- H-006 and H-007 are partial code remediations, not closed hazards.
- H-009 has no persisted UI/process-death evidence and depends on dataset-level uniqueness.
- H-010 lacks provenance-based precision policy.
- H-011 is containment for the demo, not a safe map/chart fallback proof.
- H-012 remains a release blocker despite all static checks passing.

The packet's Expo Doctor, iOS export, bundle hash, and audit statements were read but not
reproduced in this re-review; `pnpm verify` was independently reproduced.

## Release-blocking evidence still required

1. Frozen native development build on supported iPhone and iPad, plus explicit Android status.
2. Maestro and manual transition matrix for simulation on/off, outage/recovery, stale sample,
   background/foreground, process death, corrupt hydration, and rapid toggles.
3. VoiceOver, Dynamic Type, contrast, rotation, and split-view evidence for every source and
   route failure state.
4. 0/1/2-waypoint, unresolved persisted route, dataset replacement, and duplicate-dataset
   identity flows on the frozen build.
5. Independent geodesic/bearing oracle plus antimeridian, polar, identical-position, and
   property tolerance evidence.
6. A typed true/magnetic contract and, before magnetic display, a sourced/dated magnetic model
   with independent reference fixtures.
7. Airport/runway semantic and provenance chronology corpus with quarantine behavior.
8. Physical-device startup, frame pacing, thermal, memory, battery, and lifecycle traces.

## Final conclusion

Candidate `a449053` substantially reduces the risk of dangerously convincing incorrect output in
the controlled simulated vertical slice. No previously identified critical source-confusion path
remains visible in static review. Phase 1 nevertheless remains **BLOCKED** because partial
domain controls and missing native/human-factors/lifecycle evidence prevent an evidence-backed
milestone claim.
