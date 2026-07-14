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
- Production dependency audit reports no known vulnerabilities after a tested pnpm workspace
  override moves Expo/Xcode build tooling from vulnerable `uuid@7.0.3` to `uuid@11.1.1`; CI
  enforces the production audit at Moderate or higher severity.
- Expo Doctor: 20/20 checks passed on 2026-07-14 after the safety-remediation changes.
- Strict TypeScript: passed across nine implementation packages/apps.
- ESLint and Prettier: passed.
- Unit tests: 370 passed across sixty-four test files.
- iOS production JavaScript/Hermes bundle export passed on 2026-07-14 (2,206 modules, 5.7 MB
  uncompressed bundle artifact). Android production JavaScript/Hermes export passed (2,298
  modules, 5.9 MB uncompressed bundle artifact). Pinned CI now compiles both exports after the
  audit/test gate; native simulator and physical builds are not yet recorded.
- The first remediation candidate adds an atomic fail-closed simulated position source, route
  resolution blocking, explicit data-currency classification, semantic airport validation, and a
  generic typed weight-and-balance core. Independent re-review keeps Phase 1 blocked.
- Provenance trust and currency helpers reparse the complete bounded contract at point of use,
  reject future retrieval, malformed values, and one-sided currency intervals, and reserve
  `unknown` for an explicitly absent effective/expiry pair.
- Independent QA found malformed-JSON, non-finite-position, and duplicate-route recovery
  defects; all three now have fail-closed boundaries, permanent regression tests, and an
  independent targeted closure review.
- A conservative METAR/SPECI adapter now preserves raw/provenance data, explicit visibility
  bounds, observation time, and unsupported body groups. An offline manual decoder labels all
  input unverified and currency-unknown. An on-demand AWC client retrieves one bounded raw METAR
  with a one-minute request interval, provider/station validation, source provenance, and
  currency evaluation. The same client retrieves one bounded raw TAF with station binding and a
  shared request gate. A conservative header parser resolves issue/amendment state and UTC
  validity across month boundaries. A second pass identifies bounded FM/TEMPO/BECMG/PROB change
  marker timing while leaving every forecast condition body raw and uninterpreted. Successful
  raw reports now persist in a bounded per-product/station SQLite cache with receipt/source
  times. Reads revalidate and reparse source text, cached results are visibly labelled, METAR
  currency and TAF header validity are recomputed. Confirmed per-product and clear-all deletion
  let users remove local raw products, including recovery when the cache cannot be listed.
  Displayed currency/validity reevaluates every 30 seconds and on app resume, with separate
  non-destructive display clear controls. Decoded observations derive a separately labelled U.S.
  NWS display category from the worse parsed ceiling/visibility input, preserve threshold
  evidence, and fail closed on incomplete or ambiguous inputs. The category is not presented as
  worldwide or regulatory. A progressively disclosed FAA rule-of-thumb density-altitude estimate
  accepts user-entered field elevation only alongside a current trusted real-source decoded
  temperature and altimeter setting, exposes its intermediate approximations, and remains
  explicitly separate from aircraft performance or runway suitability. Native network/cache
  recovery QA and briefing completeness remain open.
- A typed true-reference wind triangle returns heading, signed correction, and groundspeed or an
  explicit no-solution state. Route legs can now produce wind-adjusted ETE or identify the
  blocking leg, and Plan exposes a clearly labelled constant-wind sandbox. Winds-aloft sourcing
  and a durable plan-assumptions model remain open.
- Pure route resolution bounds both requested and available waypoint collections and revalidates
  identifier and coordinate ranges before geospatial calculations consume typed runtime values.
- Spherical geospatial entrypoints independently reject forged out-of-range coordinates and
  destination bearings before performing trigonometric calculations.
- Wind-triangle and runway-component entrypoints likewise revalidate branded true directions and
  finite bounded speeds at runtime.
- Generic loading and density-altitude entrypoints enforce finite physical-domain bounds even
  when branded numeric types are forged at a runtime boundary.
- Active-leg navigation withholds ETE when groundspeed is absent, non-finite, non-positive, or
  beyond the supported 1,000 KT planning domain.
- Simulation advance/hold, native location mapping, and availability evaluation share complete
  coordinate, telemetry, clock, and track-reference validation; malformed prior samples cannot
  survive a lifecycle hold or restart an advance.
- Session trail append and geometry generation reject oversized, mixed-source, unordered,
  negative-clock, and malformed-coordinate histories before they reach the map renderer.
- Separate versioned user and control SQLite schemas now migrate before app render. Executable
  schema tests enforce key relational constraints, and the pure offline-region lifecycle keeps
  active data independent from update failure while rejecting cross-attempt, incomplete,
  wrong-region, invalid-time, and unauthorized-rollback transitions. Filesystem, signature, and
  atomic activation adapters remain open. A read-only System manager now cross-checks active
  pointers, manifests, file metadata, and recent attempts before reporting registry state, while
  explicitly stating that filesystem contents have not been rehashed. The manager separately
  reconstructs active pointers/generations, file rows, and recent attempts from one exclusive
  control-database snapshot. The manager separately reports validated native available/total
  device capacity without treating it as reserved application space or package-fit evidence.
- User database migration v8 stores normalized airport favourites independently from replaceable
  aviation datasets and adds the bounded raw-weather cache. Places can add/remove and visibly
  mark favourites; a corrupt favourite collection disables only preference decoration while
  airport browsing remains available.
- Airport dossiers expose runway geometry and full available provenance metadata, rank nearby
  demonstration airports by validated great-circle distance, and explicitly mark frequencies,
  services, fuel, notes, and NOTAM as unavailable rather than inventing values. Sunrise/sunset
  is a separate NOAA-derived local astronomical calculation for the airport's current local
  calendar date, shown in UTC with polar/invalid failure states and no legal day/night or
  operational claim.
- Places can calculate transient steady and optional gust headwind/tailwind/crosswind components
  for both ends of a runway only from an explicit user-entered true wind and supplied true
  runway heading. Inputs fail closed outside 0–359°T and 0–300 KT; no METAR binding, magnetic
  conversion, aircraft limit, runway choice, or operational recommendation is inferred.
- A local Records workspace now writes validated logbook entries through parameterized SQLite
  transactions and labels regulatory compliance as unevaluated. An atomic dashboard and
  exclusive keyset pagination bound each rendered page to 100 validated entries and 2,000
  attachment relations while validating constant-memory all-time SQLite aggregates. Migration v2
  preserves v1 rows and moves attachments to relational references; a database failure stops the
  normal shell. The creation form now records every modeled duration plus bounded approach and
  day/night landing counts; loaded rows display those facts without evaluating compliance.
  Native recovery and visual/accessibility QA remain open. Saved aircraft references and up to
  20 document attachments are selectable; their libraries fail independently so corrupt
  reference metadata does not hide valid entries. React Native Web is not a usable visual-QA
  surface because the current MapLibre native module fails its web codegen boundary before
  render. Once all rows are loaded, a 2,000-entry-bounded CSV snapshot revalidates each entry,
  preserves integer facts, neutralizes spreadsheet formula prefixes, verifies its temporary
  file, and opens the native share sheet without claiming transfer success or regulatory
  completeness. Multiline remarks preserve normal whitespace but reject NUL and unsupported
  control bytes at the domain boundary.
- The Library now supports user-authored normal, abnormal, and emergency-labelled checklist
  templates without bundling aircraft procedures. Active runs retain immutable revision
  snapshots and use compare-and-swap state revisions for atomic completion updates. Templates
  can link validated local aircraft profiles and can be edited through an atomic
  compare-and-swap next revision without changing existing run snapshots. Migration v6 adds
  immutable abandonment history and a database-level one-open-run constraint. Every surface
  remains unverified. Recent terminal runs can expand a read-only locked snapshot with exact
  UTC, elapsed time, revision evidence, full item text/critical flags, and each completed or
  unchecked outcome. Open/history completion relations now use domain-sized sentinel limits
  before decoding to stop unbounded reads and silent truncation. Template/item reconstruction
  now uses one exclusive read snapshot; native concurrency, recovery, and accessibility evidence
  are open. Template labels, titles, challenges, and responses reject embedded display controls.
- PDF-only document import now validates UUID paths, MIME and bounded container markers; copies
  into app-private storage; verifies SHA-256 after the copy; and persists revalidated metadata
  and bookmark relations. The reader is explicitly disabled pending native malformed-file,
  accessibility, memory, and offline QA. A non-destructive private-storage audit reports
  missing, changed-size, misplaced, and unregistered entries without deleting bytes or rehashing
  on every load. Favourite, folder, and manual bookmark metadata can be edited with validated
  labels and conflict-aware writes without enabling the reader; document/bookmark reconstruction
  uses one exclusive read snapshot. An explicit share action reconstructs the UUID path, rereads
  the bounded PDF, rechecks container markers, length, and SHA-256, and opens the native sheet
  only for an exact imported copy without claiming delivery.
- The development simulator now accepts a bounded starting airport, altitude, groundspeed, true
  track, vertical speed, and horizontal-accuracy profile. Position and climb updates are bounded
  to five-second ticks, longer lifecycle gaps pause in place, and invalid time, origin, track,
  or altitude transitions fail into an explicit simulated GPS outage. Configuration persists but
  live samples do not. A session pause keeps a fresh stationary simulated sample and resumes
  without accumulating paused time. The source-aware timer reducer now leaves device telemetry
  untouched and fails invalid simulator clocks/origins into outage. Native AppState now stops
  the root interval outside active state and performs a conservative immediate tick on return.
  Native timer, lifecycle, and physical-device behavior remain unverified.
- User-entered aircraft profiles now persist locally with explicit kilogram, metre, litre, and
  knot units, immutable unverified provenance, schema revision, parameterized writes, and a
  fail-closed JSON read boundary. User fields can advance through compare-and-swap revisions
  while identity, units, provenance, and unverified status stay fixed. The fictional loading
  sandbox remains separate. A selected profile can calculate mass, moment, CG arm, and entered
  maximum-mass status. Profiles may now carry an optional bounded user-entered CG polygon;
  duplicate, degenerate, and self-intersecting geometry fails closed before the UI reports an
  inside/outside decision. Approved source linking, revision history, durable
  stations/scenarios, graph rendering, and native recovery remain open. A session-only loading
  scenario can add up to eight bounded labelled mass/arm stations to the same total mass,
  moment, CG, and entered-envelope calculation; selecting another profile clears them, and they
  are not persisted. The pure loading boundary independently caps scenarios at 100 stations and
  rejects non-finite mass/arm/limit values plus empty, oversized, or control-bearing
  identifiers. Optional 5,000-character multiline profile notes now create, display, and revise
  through the same conflict-aware record boundary while rejecting unsafe controls. Confirmed
  permanent deletion runs reference checks and a current-revision delete in one exclusive
  transaction; any saved-flight, checklist, or logbook reference preserves the profile instead
  of detaching history.
- An explicit user action can now select a foreground-only device-location source. Permission,
  service, provider-error, null-telemetry, and stale-sample states fail closed; metric provider
  values convert to cockpit units at a pure boundary, and source changes clear prior samples.
  App background and provider errors explicitly remove the watcher and sample; active rechecks
  permission/services, with generation guards blocking callbacks from an older lifecycle. The
  own-ship marker exposes source, accuracy, and true-track/platform-course semantics through
  both shape/text and an accessible image label. Native permission, lifecycle, accuracy, energy,
  and physical-device evidence remain open.
- Dedicated high-contrast day and night palettes follow iOS Increase Contrast and Android High
  contrast text, including live setting-change subscriptions. Automated token checks enforce
  documented semantic contrast thresholds, and the demonstration map uses the selected palette.
  Native rendering, accessibility-tree, glare, and dark-adaptation evidence remain open.
- Resolved demonstration routes can now be saved and loaded through transactional SQLite flight
  and waypoint records. Reads reconstruct rows and sentinel-bounded waypoints in one exclusive
  snapshot before revalidating ordered plans; active and archived panes split one shared bounded
  snapshot so concurrent status changes cannot create a mixed library. Future updates use a
  compare-and-swap revision, and loading blocks if coordinates or dataset source references have
  drifted. Drafts can link aircraft profiles, rename, replace route snapshots after
  confirmation, archive, and restore through compare-and-swap revisions. One detail editor can
  revise title, aircraft assignment, whole-foot cruise altitude, explicit UTC departure time,
  and notes atomically; multiline notes retain normal whitespace while rejecting unsupported
  controls. Saved records can be duplicated as independent revision-one drafts, and ephemeral
  waypoints can move up/down with every route edit clearing active-leg selection. A bounded
  current-route GPX snapshot revalidates geometry, escapes XML, verifies its cache write, omits
  invented time/elevation, and stays explicitly fictional and unverified. MMKV no longer claims
  route durability; drag editing, a native date/time picker, and richer conflict UI remain open.
- With a saved aircraft selected, Plan now derives a transient cruise-only litre estimate from
  wind-adjusted ETE and entered fuel burn, then compares it with entered usable fuel. The UI
  explicitly excludes taxi, climb, descent, contingency, alternate, and reserve fuel; scenario
  persistence and full fuel planning remain open.
- Plan can select a fictional transient alternate and independently calculate the
  destination-to-alternate distance, constant-wind ETE/no-solution state, and cruise-only fuel.
  Destination changes clear it, it is excluded from headline fuel, and durable alternate intent
  remains open.
- Plan now requires explicit transient active-leg selection; every route mutation clears it.
  With a fresh position, the map derives next distance, true bearing, signed cross-track,
  remaining distance, and groundspeed-based next/route ETE through a pure spherical calculator.
  Exact antipodal pairs fail closed instead of emitting an arbitrary initial bearing. It also
  displays a bounded transient destination UTC ETA with explicit date rollover and clock failure
  states. There is no automatic sequencing, magnetic course, or certification claim.
- The map navigation strip now exposes position source, sample age, horizontal accuracy, battery
  percentage, charging state, and system low-power mode. Unsupported or malformed native battery
  telemetry fails to an explicit unavailable state; physical-device events, energy impact, and
  endurance behavior remain unverified.
- The map starts north-up and can explicitly follow a fresh reported true/platform course in
  track-up. Missing or stale position/course returns the camera to north with a visible fallback
  state rather than retaining rotation. Native gesture interaction and mounted-device camera
  behavior remain unverified.
- An opt-in transient map measure tool accepts two long presses, renders labelled endpoints and
  a line, and reports great-circle nautical miles plus initial true bearing. It clears on exit,
  never mutates route intent, and still needs native gesture/accessibility evidence.
- Places can explicitly start session-only direct-to guidance to a demonstration airport without
  mutating the saved route. Direct-to and active-leg intent are mutually exclusive, all route
  edits cancel direct-to, and position loss removes its line/calculations while preserving a
  visible target/failure state. Automatic sequencing and native cockpit validation remain open.
- A session layer panel can independently hide the demo grid, fictional airports, and stored
  route backdrop. Guidance/ownship evidence cannot be hidden, and the visible legend explicitly
  names both rendered symbols and absent chart/airspace/terrain/weather classes. Native touch
  and screen-reader validation remain open.
- Outside measure mode, map long-press now inspects one validated coordinate and reports nearest
  fictional-airport great-circle distance/true bearing. It explicitly withholds chart, terrain,
  airspace, obstacle, and weather inspection; native gesture QA remains open.
- Optional session-only 5/10/20 NM ownship range rings use bounded spherical geometry from a
  fresh position and split antimeridian crossings to avoid world-spanning lines. They disappear
  on position loss and explicitly carry no accuracy, terrain, chart-scale, radar, or airspace
  meaning; native rendering remains unverified.
- A session-only map breadcrumb retains at most 120 distinct moved coordinates, refreshes time
  without duplicating stationary points, splits antimeridian crossings, and resets on source
  loss, source changes, clock rollback, replacement samples, or explicit clear. It is not
  persisted or represented as a flight record; native rendering/lifecycle evidence remains open.
- Phase 1 gate remains open; no performance or operational-readiness claim is made.

## Last updated

2026-07-14
