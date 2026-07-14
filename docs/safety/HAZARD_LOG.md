# Phase 1 hazard log

## Scope and decision rule

This log is an independent static red-team review of commit `e96a2e2` (the Phase 1 mobile
vertical slice and its core packages). It asks whether the software can present incorrect or
unsupported information with enough cockpit-like polish to be believed. It is not an approval
for flight use.

Severity means:

- **Critical**: credible path to confusing fabricated/stale information with a live navigation
  source; release must stop.
- **High**: safety-significant incorrect, ambiguous, or unsupported output; release must stop
  for any scope that exposes the function.
- **Medium**: defence or evidence gap that is contained by the current demonstration scope, but
  must be resolved before the affected function expands.
- **Low**: limited safety impact or documentation/test debt.

`Release blocking` refers to closing the Phase 1 milestone or distributing the build beyond a
controlled development demonstration. The entire candidate remains explicitly unsuitable for
operational navigation.

## Summary

| ID    | Hazard                                                                | Severity | Release blocking |
| ----- | --------------------------------------------------------------------- | -------- | ---------------- |
| H-001 | Simulation can be disabled while simulated navigation output remains  | Critical | Yes              |
| H-002 | Position has no age/accuracy/source contract and outage is volatile   | Critical | Yes              |
| H-003 | Ownship glyph implies unsupported heading, track, and precision       | High     | Yes              |
| H-004 | Zero/one-waypoint routes still produce convincing ownship/ETE output  | High     | Yes              |
| H-005 | Missing expiry and invalid verification can be treated as not stale   | High     | Yes              |
| H-006 | Airport validation is syntactic, not aeronautically semantic          | High     | Yes              |
| H-007 | True/magnetic reference is not enforced end to end                    | High     | Yes              |
| H-008 | `NEAREST` makes a calculation claim but performs no nearest search    | High     | Yes              |
| H-009 | Persisted unknown route identifiers are silently omitted              | High     | Yes              |
| H-010 | Units are labelled, but provenance-based precision is not constrained | Medium   | Yes              |
| H-011 | Blank map can still look spatially authoritative                      | Medium   | No, demo only    |
| H-012 | Verification coverage is too narrow for the Phase 1 safety gate       | High     | Yes              |

## Detailed findings

### H-001 — Simulation can be disabled while simulated navigation output remains

- **Severity:** Critical
- **Evidence:** `simulationEnabled` controls only the outer border and status wording
  (`apps/mobile/app/index.tsx:21-47`, `apps/mobile/src/components/StatusPlane.tsx:9-38`). The
  map never reads it. It always derives ownship from a fixture airport and displays hard-coded
  `118 KT` and `4,500 FT GPS` whenever `gpsOutage` is false
  (`apps/mobile/src/components/MapWorkspace.tsx:52-90,147-165`). The System page continues to
  call the position `simulated · fixture origin` even after the simulation switch is off
  (`apps/mobile/src/components/SystemWorkspace.tsx:23-27,44-47`). No production code consumes
  `expo-location`.
- **Dangerous outcome:** A user turns simulation off, sees `POSITION STANDBY` rather than
  `SIMULATION`, then sees a directional ownship and plausible speed/altitude. The most important
  source distinction has become less visible while the fabricated values remain.
- **Release blocking:** Yes. This directly violates the real/simulated source-confusion
  automatic block.
- **Mitigation:** Model source as a closed state machine (`simulated`, `device`, `external`,
  `unavailable`) rather than independent booleans. Never render ownship or sensor-derived values
  unless a source sample with timestamp and accuracy passes policy. Simulation-off with no real
  adapter must be `POSITION UNAVAILABLE`, with all position-dependent output removed.
- **Verification:** UI/state-machine tests for every source transition, including app restart
  and background recovery; assert source banner, ownship, and every dependent field from one
  atomic snapshot. Physical-device test must prove simulated samples cannot enter the
  real-source path.

### H-002 — Position has no age/accuracy/source contract and outage is volatile

- **Severity:** Critical
- **Evidence:** The store represents position validity with only `gpsOutage: boolean`
  (`apps/mobile/src/store/flight-store.ts:9-22`). It has no sample timestamp, monotonic receipt
  time, horizontal/vertical accuracy, provider, permission, or lifecycle state. `gpsOutage` is
  omitted from persisted fields (`apps/mobile/src/store/flight-store.ts:59-67`), so process
  restart resets it to false (`apps/mobile/src/store/flight-store.ts:43`). The map gates only GS
  and ALT on that boolean (`apps/mobile/src/components/MapWorkspace.tsx:147-170`).
- **Dangerous outcome:** A stale or unavailable source can become apparently healthy after
  restart, and a frozen last-known sample could have no age indication. There is no way to
  distinguish permission denial, no fix, stale fix, degraded accuracy, injected outage, or
  source handover.
- **Release blocking:** Yes.
- **Mitigation:** Introduce an immutable position sample/envelope containing source, origin,
  coordinate, wall and monotonic timestamps, horizontal/vertical accuracy, track/heading
  validity, and explicit availability reason. Derive all UI from freshness/accuracy policy;
  persist simulator scenario separately but never persist a transient healthy/failure conclusion
  as live truth.
- **Verification:** Deterministic clock tests at freshness boundaries; permission revoke, GPS
  loss, stale/frozen sample, process death, foreground/background, clock rollback, and
  external/device source-switch scenarios. Assert no stale numeric value retains a healthy
  presentation.

### H-003 — Ownship glyph implies unsupported heading, track, and precision

- **Severity:** High
- **Evidence:** Ownship is placed exactly on the first route airport (or a default fixture
  airport) (`apps/mobile/src/components/MapWorkspace.tsx:89,147-150`). Its arrow always points
  upward and its two fixed circles have no accuracy semantics
  (`apps/mobile/src/components/OwnshipGlyph.tsx:8-17`). No heading, track, or accuracy enters
  the component; its only input is `degraded`.
- **Dangerous outcome:** The aircraft-shaped arrow can be read as current track/heading and the
  rings as an accuracy halo, despite neither being measured. Exact placement on a waypoint
  implies far more precision than the low-confidence fixture supports.
- **Release blocking:** Yes.
- **Mitigation:** Use a non-directional simulated-position mark until track or heading is valid.
  Rotate only from a labelled, fresh source and distinguish track from heading. Scale a
  documented accuracy halo in map metres, hide the symbol when position is unavailable, and
  label fixture teleport/start positions unmistakably.
- **Verification:** Golden screenshots and accessibility assertions for unknown, stale,
  degraded, valid-track, valid-heading, and GPS-outage states at multiple zoom levels and map
  rotations.

### H-004 — Zero/one-waypoint routes still produce convincing ownship/ETE output

- **Severity:** High
- **Evidence:** `calculateRoute` accepts zero or one waypoint, produces no legs, and computes
  `estimatedMinutes` as zero for positive groundspeed
  (`packages/flight-planning/src/route.ts:40-62`). The Plan UI therefore formats `0.0 NM` and
  `0 MIN` (`apps/mobile/src/components/PlanWorkspace.tsx:21-42`). With no route, the map falls
  back to the first airport for ownship; with one waypoint, it puts ownship on that waypoint
  (`apps/mobile/src/components/MapWorkspace.tsx:59-90`). GS/ALT remain plausible constants
  (`apps/mobile/src/components/MapWorkspace.tsx:163-170`).
- **Dangerous outcome:** An empty plan can look like a completed zero-duration route while the
  map invents an aircraft location. A one-point plan looks as if the aircraft is already at that
  point.
- **Release blocking:** Yes.
- **Mitigation:** Give route calculation an explicit validity/status result. Zero waypoints
  means `NO ROUTE`; one means `INCOMPLETE ROUTE`; neither has ETE or route distance presented as
  a completed calculation. Ownship must be independent of route endpoints.
- **Verification:** Unit and UI tests for 0, 1, 2, repeated-position, repeated-identifier, and
  one-waypoint direct-to scenarios. Assert unavailable symbols rather than numeric zero where
  the quantity is undefined.

### H-005 — Missing expiry and invalid verification can be treated as not stale

- **Severity:** High
- **Evidence:** The provenance schema permits null effective/source/expiry times and includes an
  `invalid` verification state without enforcing display/use policy
  (`packages/data-contracts/src/confidence.ts:3-26`). `isStale` returns `false` whenever expiry
  is absent (`packages/data-contracts/src/confidence.ts:30-32`). The fixture itself has no
  effective or expiry time (`packages/aviation-domain/src/demo-airports.ts:3-14`). Places
  exposes only the source, not verification, confidence, retrieval, effective, or expiry status
  (`apps/mobile/src/components/PlacesWorkspace.tsx:95-103`).
- **Dangerous outcome:** Unknown currency can collapse into “not stale,” and an object
  explicitly marked invalid can still flow through the domain and UI as an Airport.
- **Release blocking:** Yes for Phase 1 closure and for any non-fixture dataset.
- **Mitigation:** Replace boolean staleness with
  `current | near-expiry | expired | unknown | invalid` plus reason. Define per-data-type
  required timestamps. Reject/quarantine invalid provenance at operational adapters and require
  point-of-use source/currency presentation.
- **Verification:** Table tests for null/invalid times, future retrieval,
  expiry-before-effective, clock rollback, unknown timezone, invalid verification, and boundary
  equality. UI tests must show dominant unknown/invalid states.

### H-006 — Airport validation is syntactic, not aeronautically semantic

- **Severity:** High
- **Evidence:** Coordinates and positive runway dimensions are bounded, but airport identifiers
  are only length-checked, timezone is any non-empty string, elevation is any number, runway
  designator/surface are free text, duplicate runways are accepted, and heading need not agree
  with designator (`packages/aviation-domain/src/airport.ts:11-36`). The sole malformed-airport
  test combines an out-of-range coordinate with an unknown field, so it does not isolate other
  failure classes (`packages/aviation-domain/src/airport.test.ts:15-27`).
- **Dangerous outcome:** A malformed yet plausible airport/runway record can render dimensions,
  position, or runway identity without an alert. Cross-field contradictions are more dangerous
  than obvious parse failures because they look valid.
- **Release blocking:** Yes before external/local airport ingestion is credited toward Phase 1.
- **Mitigation:** Add canonical identifier policy by jurisdiction, IANA timezone validation,
  operational elevation/dimension bounds with explicit exceptions, unique runway identities,
  reciprocal/designator/heading consistency policy, normalized surfaces, provenance chronology,
  and dataset-level duplicate/conflict checks. Quarantine records rather than partially
  rendering.
- **Verification:** One-fault-per-fixture tests plus fuzz/property corpora for NaN/infinity,
  malformed identifiers, invalid timezones, duplicates, extreme dimensions/elevations,
  contradictory headings/designators, and provenance contradictions.

### H-007 — True/magnetic reference is not enforced end to end

- **Severity:** High
- **Evidence:** Route legs explicitly store `initialTrueCourse`
  (`packages/flight-planning/src/route.ts:14-18,47-50`) and runways store `headingTrueDegrees`
  (`packages/aviation-domain/src/airport.ts:15-22`), but the general `Degrees` runtime value
  carries no north-reference metadata (`packages/data-contracts/src/units.ts:3-11`). There is no
  magnetic model, variation epoch/source, conversion contract, or point-of-use course label.
  Places shows a runway designator but omits the true heading and its reference
  (`apps/mobile/src/components/PlacesWorkspace.tsx:105-123`).
- **Dangerous outcome:** A future UI or calculation can pass a numerically valid true bearing
  into a magnetic context with no runtime failure. Runway designators are conventionally
  magnetic in many jurisdictions while the stored numeric heading is true, inviting silent
  conflation.
- **Release blocking:** Yes for the Phase 1 bearing/course claim; current UI avoids displaying a
  numeric course but the gate cannot close without the contract.
- **Mitigation:** Use distinct `TrueDegrees` and `MagneticDegrees` domain types and a conversion
  result carrying model, epoch, source, position, uncertainty, and unavailable state. Label
  north reference at every point of use and document jurisdictional runway-designator semantics.
- **Verification:** Compile-time and runtime mismatch tests, magnetic-model reference fixtures
  by date/location, unavailable/out-of-coverage cases, and screenshots showing `°T`/`°M`
  explicitly.

### H-008 — `NEAREST` makes a calculation claim but performs no nearest search

- **Severity:** High
- **Evidence:** The `⌖ NEAREST` control only executes `setWorkspace('places')`
  (`apps/mobile/src/components/MapWorkspace.tsx:173-183`). Places defaults to all fixture
  airports or its prior selection; it does not receive an ownship position, compute distance, or
  sort by proximity (`apps/mobile/src/components/PlacesWorkspace.tsx:12-24,48-84`).
- **Dangerous outcome:** In a time-critical workflow, a pilot can reasonably interpret the
  destination list as nearest-ranked when it is fixture order or stale selection.
- **Release blocking:** Yes. Phase 1 explicitly disallows placeholder controls.
- **Mitigation:** Rename to a non-claiming `PLACES` action until a verified nearest function
  exists, or implement distance-ranked results from a fresh position with distance, bearing
  reference, coverage, filters, and unavailable state.
- **Verification:** UI flow tests with known geometry, ties, no fix, stale fix, outside
  coverage, antimeridian, and polar cases; assert displayed ordering and distances against an
  independent oracle.

### H-009 — Persisted unknown route identifiers are silently omitted

- **Severity:** High
- **Evidence:** Route identifiers persist independently of a dataset version
  (`apps/mobile/src/store/flight-store.ts:59-69`). Both Plan and Map resolve them against the
  current in-memory fixtures and silently filter missing entries
  (`apps/mobile/src/components/PlanWorkspace.tsx:19-27`,
  `apps/mobile/src/components/MapWorkspace.tsx:55-71`). No warning preserves or blocks the
  original route intent.
- **Dangerous outcome:** After a dataset/schema update or corrupted preference, a route can
  silently lose an endpoint or intermediate waypoint and then display a recalculated, plausible
  shorter distance/ETE.
- **Release blocking:** Yes.
- **Mitigation:** Persist stable dataset-scoped waypoint references plus a route revision.
  Resolve atomically and return explicit unresolved/conflicting waypoints; never calculate a
  replacement route until the user reviews it. Preserve original intent for recovery.
- **Verification:** Persistence tests across dataset version change, deleted/renamed/conflicting
  identifiers, corrupt storage, and process death. Assert calculations are blocked and missing
  waypoints remain visible.

### H-010 — Units are labelled, but provenance-based precision is not constrained

- **Severity:** Medium
- **Evidence:** Navigation, elevation, runway dimensions, and route summary do display units
  (`apps/mobile/src/components/MapWorkspace.tsx:163-170`,
  `apps/mobile/src/components/PlacesWorkspace.tsx:95-117`,
  `apps/mobile/src/components/PlanWorkspace.tsx:35-42`). However, Positions reuse a generic
  `Degrees` type (`packages/geospatial/src/position.ts:3-15`), branded units are runtime numbers
  (`packages/data-contracts/src/units.ts:1-28`), and Places prints low-confidence unverified
  fixture coordinates to four decimal places without datum or uncertainty
  (`apps/mobile/src/components/PlacesWorkspace.tsx:95-103`,
  `packages/aviation-domain/src/demo-airports.ts:3-14`).
- **Dangerous outcome:** Explicit unit labels reduce conversion ambiguity, but numeric precision
  can still imply roughly 10-metre coordinate confidence unsupported by source metadata. Runtime
  adapters can also mis-tag a value if they select the wrong constructor.
- **Release blocking:** Yes for Phase 1 evidence because point-of-use precision/units policy is
  not tested; medium within the clearly fictional demo.
- **Mitigation:** Centralize formatting by quantity/source confidence, include datum and
  uncertainty, introduce semantic altitude/reference types, and require conversions at typed
  adapter boundaries.
- **Verification:** Unit round-trip and wrong-constructor adapter tests; locale formatting;
  MSL/AGL/FL, feet/metres, knots/km/h, coordinate/datum, and precision-policy screenshot
  matrices.

### H-011 — Blank map can still look spatially authoritative

- **Severity:** Medium
- **Evidence:** The app intentionally uses an empty background style, grid, scale bar, airport
  markers, route, and ownship (`apps/mobile/src/components/MapWorkspace.tsx:22-50,91-152`). It
  does state `OFFLINE DEMO GRID` and `No chart data loaded` in the map overlay
  (`apps/mobile/src/components/MapWorkspace.tsx:154-161`) and the System page repeats that there
  is no chart/terrain/obstacle data (`apps/mobile/src/components/SystemWorkspace.tsx:40-55`).
- **Dangerous outcome:** Route geometry and ownship on a polished rotatable map may still be
  mistaken for a chart, and the scale bar can imply complete geographic context despite no
  airspace, terrain, obstacles, shorelines, or chart symbology.
- **Release blocking:** No for a supervised internal demo because the no-chart warning is
  persistent and direct. Yes before any operational/situational-awareness distribution.
- **Mitigation:** Keep a dominant watermark across the map viewport, label coverage/layer
  absence at point of use, prevent screenshots from omitting the warning, and never use
  chart-like symbology without source/licence/effective-cycle evidence.
- **Verification:** Day/night, rotation, split-view, zoom, screenshot, and screen-reader checks
  proving the warning cannot be obscured; coverage-boundary and missing-layer tests before real
  maps.

### H-012 — Verification coverage is too narrow for the Phase 1 safety gate

- **Severity:** High
- **Evidence:** The suite has deterministic happy-path distance/course and basic zero-length
  failure tests (`packages/geospatial/src/great-circle.test.ts:13-43`), basic route tests
  (`packages/flight-planning/src/route.test.ts:8-30`), one finite-unit rejection
  (`packages/data-contracts/src/units.test.ts:29-31`), and one combined malformed airport case
  (`packages/aviation-domain/src/airport.test.ts:15-27`). There are no mobile component/state
  tests, sensor/source tests, simulator lifecycle tests, staleness tests, independent magnetic
  oracle, antimeridian/polar properties, accessibility evidence, or native-device evidence in
  this commit.
- **Dangerous outcome:** Passing `pnpm verify` can be over-read as safety evidence even though
  it cannot detect the source-confusion and UI-claim hazards above.
- **Release blocking:** Yes.
- **Mitigation:** Build the failure-oriented matrix required by
  `docs/testing/PHASE_GATE_CHECKLIST.md` and keep automated software checks distinct from
  operational/safety acceptance evidence.
- **Verification:** Independent review of raw artifacts for the frozen candidate; require
  traceable hazard-to-test links and first-attempt native UI flows before changing any gate
  status.

## Positive controls observed

- The app defaults simulation on and shows a persistent top status component
  (`apps/mobile/src/store/flight-store.ts:56`, `apps/mobile/app/index.tsx:51-53`).
- GPS outage replaces GS/ALT with em dashes and changes ownship to an X
  (`apps/mobile/src/components/MapWorkspace.tsx:147-165`,
  `apps/mobile/src/components/OwnshipGlyph.tsx:10-17`).
- Map and System state that no chart/current operational layers are loaded
  (`apps/mobile/src/components/MapWorkspace.tsx:154-161`,
  `apps/mobile/src/components/SystemWorkspace.tsx:40-55`).
- Plan and Aircraft contain explicit demonstration/non-navigation warnings
  (`apps/mobile/src/components/PlanWorkspace.tsx:96-99`,
  `apps/mobile/src/components/AircraftWorkspace.tsx:22-40`).
- Coordinate bounds, finite unit construction, positive runway dimensions, duplicate route
  identifiers, and undefined zero-length bearings have some fail-closed handling.

These controls materially reduce accidental reliance, but they do not neutralize H-001 through
H-004 because the contradictory numeric/graphical output is more immediate than the limitations.

## Review assumptions

- Review target is source commit `e96a2e2`; no uncommitted implementation was included.
- The branch is a development slice, not an app-store or operational release candidate.
- Static inspection cannot prove visual prominence, native lifecycle behavior, MapLibre geometry
  acceptance, accessibility reading order, or physical-device sensor behavior.
- “Release blocking” is evaluated against the repository's own Phase 1 and automatic-block
  rules, not against certification standards for an approved EFB.
