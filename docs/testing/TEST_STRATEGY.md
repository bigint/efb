# Test strategy

## Mission and non-claims

Verification must prevent dangerously convincing incorrect output, not merely prove that screens
render. Phase 0 contains no application code, test harness, or measured result. This strategy
defines the required evidence for later phases; it must not be summarized as tests passing until
the corresponding artifact exists and was executed on the declared build and device.

## Governing principles

- Test framework-independent aviation calculations below the UI with exact, typed inputs and
  deterministic outputs.
- Derive high-consequence expected values independently from production code. Calling the same
  library twice is not an independent oracle.
- Treat malformed, missing, stale, ambiguous, simulated, and corrupt states as first-class
  cases. A safe failure is part of the expected result.
- Keep wall clock, monotonic clock, timezone database, locale, random source, network, sensors,
  filesystem, and dataset version injectable.
- Prefer semantic/user-visible assertions over implementation details and broad snapshots.
  Snapshots may support visual review but cannot approve navigation values, accessibility,
  stale-data state, or safety copy.
- A flaky safety test is a defect. Quarantine never counts as passing a gate.
- Every release claim links to reproducible evidence with commit, build, data, toolchain,
  device, environment, and raw result.

## Test layers

| Layer                     | Primary scope                                                       | Tooling direction                                       | Gate expectation                 |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------- |
| Static                    | strict types, lint, forbidden imports, secrets, licences, schemas   | TypeScript, ESLint, repository scripts                  | every change                     |
| Pure unit                 | geospatial, units, weather parsers, flight planning, W&B, time      | Vitest or Jest, property testing                        | every change; deterministic      |
| Contract/component        | adapters, SQLite repositories, network schemas, state/UI            | React Native Testing Library, ephemeral DB, mock server | every change in affected package |
| Native integration        | sensors, secure storage, permissions, background tasks, files       | iOS/Android test harness and development build          | affected platform change         |
| End to end                | user journeys and failure recovery                                  | Maestro plus controlled simulator services              | smoke on PR; full release matrix |
| Exploratory/human factors | glare, mounted distance, turbulence/coarse touch, misleading states | physical devices and scripted protocol                  | milestone/release                |
| Performance/reliability   | latency, frame pacing, memory, battery, thermal, endurance          | native profilers and in-app signposts                   | baseline and release comparison  |
| Independent review        | safety hazards, privacy flows, security gates                       | QA, Red Team, pilots/human factors                      | no self-approval                 |

## Deterministic harness contract

The test harness provides:

- `Clock`: wall-clock instant plus monotonic elapsed time, independently advanceable and
  reversible for rollback tests;
- `TimeZoneProvider`: pinned IANA tzdb version and explicit zone ID, never host timezone by
  accident;
- `RandomSource`: seeded IDs/noise for reproducible properties;
- `SensorFeed`: timestamped source, value, accuracy, availability, real versus simulated flag,
  and injected gaps/outliers;
- `Network`: scripted latency, loss, reordering, partial content, replay, captive response, and
  offline state;
- `FileSystem`: quotas, ENOSPC, read-only, truncation, bit flips, delayed writes, and kill
  points;
- `DatasetRegistry`: trusted roots, signed manifests, valid and adversarial versions, atomic
  activation journal;
- `LocaleUnits`: locale and display-unit selection separate from canonical calculation units.

Fixtures are immutable, reviewable files with source/licence, acquisition date, expected
interpretation, and checksum. Tests never depend on today's weather, current upstream data,
public network availability, device locale, or current time unless explicitly marked non-gating
observational probes.

## Geospatial and navigation verification

### Golden corpus

For each operation, include ordinary, high-latitude, equatorial, antimeridian, near-pole,
zero-length, antipodal/near-antipodal, very short, and invalid cases:

- inverse/direct geodesic distance and initial/final bearings;
- great-circle and rhumb-line routes, explicitly distinguished;
- longitude normalization and dateline-crossing bounding boxes;
- cross-track and along-track distance with before-start/after-end behaviour;
- closest point, leg sequencing, turn/waypoint thresholds, and direct-to;
- airspace segment/polygon intersection including holes, shared boundaries, multipolygons,
  altitude bands, and dateline geometry;
- nearest-airport index against brute-force results and tie-breaking;
- route totals, ETE/ETA, wind triangle, groundspeed, magnetic/true conversions, and canonical
  unit conversions.

Expected values are generated by an independently selected authoritative or well-established
reference implementation/calculation, then frozen with its version and tolerance rationale.
Tolerances are operation- and distance-based, not a universal number chosen to make tests pass.
Bearing comparisons are circular; longitude equality accounts for equivalent normalization.

### Properties and metamorphic checks

- inverse distance is symmetric and non-negative;
- direct followed by inverse returns the starting inputs within defined error;
- route distance equals the sum of accepted legs without unit conversion drift;
- cross-track sign changes when route endpoints reverse and magnitude is stable;
- radians/degrees and nautical-mile/metre round trips remain within specified precision;
- equivalent longitude representations yield equivalent geometry;
- spatial-index answers equal brute force for seeded random corpora;
- invalid/NaN/infinite/out-of-range values are rejected, never clamped into a plausible aviation
  value without an explicit domain rule.

Property tests record seed and shrink result. Every discovered counterexample becomes a named
regression fixture.

## Units, time, timezone, and DST

Typed units are tested at input, canonical storage, calculation, and display boundaries. Cover
altitude, length, speed, vertical speed, pressure, mass, volume, fuel mass/density, temperature,
angle, and magnetic/true reference. Include zero, negatives where meaningful, boundary maxima,
rounding thresholds, mixed-unit profiles, and labels. Never compare only formatted strings.

Store instants in UTC and jurisdiction/airport zones as IANA zone IDs. Test:

- spring-forward nonexistent local times and fall-back duplicated local times;
- half-hour and 45-minute offsets, 30-minute DST, no-DST regions, southern hemisphere seasons,
  historical rule changes, and zones changing law;
- flight crossing midnight, International Date Line, DST transition, and multiple timezones;
- device timezone/locale changes while foreground, background, and killed;
- wall-clock rollback/forward while monotonic stale-age continues correctly;
- leap-day and month/year boundaries; leap seconds follow the documented platform/domain policy
  rather than an invented `:60` assumption;
- pinned tzdb upgrade tests showing intentional expectation changes.

## Parser and trust-boundary suites

Every external adapter (METAR, TAF, NOTAM when introduced, routes, manifests, SQLite, JSON, CSV,
PDFs, deep links, API responses) uses fixture classes:

1. representative valid and minimal valid;
2. real-world unusual but valid, with provenance and redistribution clearance;
3. missing, partial, duplicated, reordered, unknown and conflicting fields;
4. invalid encoding, Unicode confusables/control characters, embedded NUL, extreme
   nesting/count/length, huge numeric exponents, NaN/infinity;
5. truncation at each structural boundary, bad checksum/signature/length, compressed bombs and
   declared/actual size mismatch;
6. fuzz/property mutations with CPU, memory, and output bounds.

Parsers return discriminated success/error types with field location and reason. They never
throw across the app boundary, reuse stale fields from a previous record, or coerce malformed
operational values. A failure-state UI test proves the user sees source, age, and
unavailable/partial status.

## Offline, storage, and update matrix

Test airplane-mode start and transition, DNS/TLS failure, captive portal, latency, packet loss,
server 4xx/5xx, partial/range mismatch, app background, network switching, and multi-day offline
expiry. Required offline journeys are airport search/detail, route creation/calculation, saved
flights, aircraft and W&B, documents/checklists, map packs, and simulation.

For every dataset download/activation step, kill the process before and after the durable write.
Repeat with low disk, revoked permission, OS eviction, wrong manifest, wrong target, bit
corruption, malformed DB, failed migration, and concurrent reader. Restart must choose the
previous verified active set or the new fully verified set—never a mixture—and preserve
user-created data.

Corruption tests operate on copies of realistic databases: header/page/index bit flips,
truncation, orphan rows, semantic out-of-range coordinates/units, WAL/journal remnants, and
incompatible schema. Recovery must quarantine the bad dataset, explain impact, and avoid
destructive repair of user data without confirmation/export.

## Lifecycle, process death, and sensor tests

- Kill from map, active route edit, navigation/simulation, permission prompt, download,
  activation, migration, export, deletion, and secure-token rotation.
- Exercise background/foreground, screen lock/unlock, memory pressure, thermal pressure,
  orientation, split view, OS upgrade, backup/restore, and reinstall.
- Sensor traces cover normal motion, stationary noise, poor accuracy, delayed timestamps,
  duplicates, out-of-order fixes, jumps, drift, disagreement, heading unavailable, barometer
  loss, permission revoke, external-GNSS loss, and total outage.
- Assert the exact degradation sequence: accuracy/source/age changes, direction removed when
  heading/track is invalid, own-ship removed when position policy fails, and a labelled
  last-known marker cannot be mistaken for live data.
- Simulation is visually persistent after process death and cannot leak into a real navigation
  state or unlabelled export.

## Component, accessibility, and visual verification

React Native Testing Library queries by role, accessible name, state, value, label, and visible
text; `testID` is a last resort. Cover loading, ready, empty, stale, partial, unavailable,
denied, corrupt, and simulated states for each data-bearing surface.

Automated checks plus manual VoiceOver and TalkBack cover:

- meaningful name/role/value/state and logical reading/focus order;
- Dynamic Type/font scaling without clipped critical values;
- day, night, high contrast, Reduce Motion, bold text, colour filters, and colour-independent
  status;
- 48 by 48 point product touch target, spacing, coarse touch, keyboard, pointer, switch control
  where supported, and a non-drag alternative;
- portrait/landscape, iPhone sizes, iPad full/half/narrow split, notches/safe areas, and mounted
  viewing distance;
- announcements for status degradation without repeated disruptive speech.

WCAG 2.2 and W3C mobile guidance are baselines, not proof that a native cockpit workflow is
safe. Physical-device sunlight/night and turbulence-friendly task review remains required.

## Maestro end-to-end flows

Use separate iOS and Android flows when platform permission/lifecycle behaviour differs; avoid
conditional forests and coordinate taps. Seed fixtures through a documented test-only boundary
excluded from release builds. Assert semantic visible state and key values, not just screen
arrival.

Minimum flows by Phase 1/release maturity:

1. clean install, decline location, create and simulate a route offline;
2. grant foreground precise location, then revoke/downgrade and observe safe degradation;
3. airport search/detail and route build with unit/theme/orientation changes;
4. background/restore and process-death restore in real and simulated modes;
5. interrupted/corrupt dataset update rolls back to known-good content;
6. stale weather/source status and unavailable online content;
7. import safe document/route plus reject malicious/unsupported inputs;
8. enable/disable sync, export data, delete device/account data, reconnect a second offline
   device;
9. large text, screen reader, keyboard/pointer, and non-drag route-edit path.

Record Maestro version, OS/device, app build, fixture set, video/screenshots, logs, and JUnit
result. Automatic retry may diagnose infrastructure but the first failure remains visible and
blocks a required flow until classified.

## Measured performance and reliability

Targets are budgets to measure, not assertions: 60 fps map interaction on the declared recent
iPad, cold launch below 3 seconds where practical, ordinary GA route recalculation below 250 ms,
and local airport results below 100 ms.

Each benchmark defines production-like release build, hardware/OS, power and thermal state,
dataset/route/overlay sizes, cache state, repetitions, warm-up, instrument, percentile
statistic, and raw artifact. Report median, p95, worst, variance, failures, frame-time/jank
rather than only average FPS, JS and UI thread stalls, memory peak/leak slope, network bytes,
storage growth, and battery energy over a fixed representative session. Profilers and debug
overlays are disabled for release numbers unless their overhead is separately quantified.

Required scenarios include pan/zoom/rotate with worst supported overlays, search, route recalc,
large import/update, 30-minute and multi-hour navigation, background GPS, thermal throttling,
low battery, split view, and memory pressure. Store a baseline per supported device class and
block statistically material regression beyond an approved budget; never substitute simulator
timing for physical-device evidence.

## Security and privacy verification

Follow the threat register IDs: release-bundle secret scan, token-store lifecycle, two-account
API authorization, payload/fuzz limits, dataset signature/rollback, dependency lock/provenance,
deep-link allowlist, support-bundle redaction, network-capture location audit, and
export/deletion reconciliation. Security tests use synthetic accounts and coordinates and must
not upload real pilot data.

## Defect severity and release blocking

- **Blocker:** incorrect but plausible navigation/weather/runway/terrain/ performance state;
  real/simulated confusion; signature bypass; user-data loss; cross-account access; secret in
  release; unbounded parser; deletion/export integrity failure.
- **Critical:** crash or unavailable recovery in primary offline journey, persistent location
  leakage, inaccessible safety state, performance that makes cockpit interaction unreliable.
- **Major/minor:** triaged by reachability and workaround, but cannot be waived merely to meet a
  date.

Waivers name owner, exact build/scope, evidence, operational effect, mitigation, expiry, and
approvers from QA plus Safety/Red Team and Security/Privacy when relevant. There is no permanent
waiver for a blocker.

## Primary references

- [FAA AC 120-76E](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-76E_FAA_Web.pdf)
- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [Vitest](https://vitest.dev/)
- [React Native Testing Library: how to query](https://oss.callstack.com/react-native-testing-library/docs/guides/how-to-query)
- [Maestro documentation](https://docs.maestro.dev/getting-started)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C guidance on applying WCAG 2.2 to mobile](https://www.w3.org/TR/wcag2mobile-22/)
