# Aviation domain model

Status: Phase 0 reference model
Audience: product, aviation, data, navigation, weather, backend, and mobile teams
Safety scope: planning, education, simulation, and non-certified situational awareness only

## 1. Modelling principles

1. **A source fact is not the same thing as an app entity.** Preserve the original record, source identifier, effective interval, units, datum, and quality metadata before mapping it into a canonical entity.
2. **Every operational fact is time-bound.** Static aeronautical data needs an effective-from/effective-to interval and ingestion time. Dynamic products additionally need issue, observation, valid, cancellation, retrieval, and expiry times where applicable.
3. **Jurisdiction is data, not a build-time assumption.** Rules, terminology, units, airspace meaning, chart availability, and authorization requirements vary by State, FIR, operator, operation type, and aircraft.
4. **Unknown is a first-class value.** Missing, not applicable, withheld, unsupported, not published, and stale are distinct states. Do not turn any of them into zero, false, or an inferred operational value.
5. **Source conflicts are retained.** A precedence rule may select a display value, but the conflicting observations and the reason for selection remain queryable.
6. **Geometry is referenced.** Store horizontal datum/CRS, vertical datum, elevation reference, coordinate precision, and source geometry. Do not assume every altitude is WGS 84 ellipsoidal height or every published elevation is interchangeable.
7. **Raw wording is preserved for safety information.** A parsed NOTAM or weather product supplements, but never destroys, the original text.
8. **The model does not imply approval.** A mathematically valid route, performance result, or own-ship depiction is not an ATC clearance, weather briefing, aircraft flight manual result, or regulator authorization.

ICAO describes Aeronautical Information Management as quality-assured exchange of digital aeronautical data and identifies AIP, amendments, supplements, and digital datasets as State AIS products. Significant planned changes use common AIRAC effective dates at 28-day intervals ([ICAO AIM](https://www.icao.int/airnavigation/aeronautical-information-management), [ICAO AIRAC](https://www.icao.int/airnavigation/airac)).

## 2. Common record envelope

Every canonical record implements this envelope:

| Field | Meaning |
| --- | --- |
| `id` | Internal stable UUID; never derived only from a mutable public identifier. |
| `kind` | Versioned canonical entity type. |
| `sourceRefs[]` | Source, source record ID, source edition/cycle, retrieval URI, checksum, and licence snapshot ID. |
| `jurisdictions[]` | State, FIR/UIR, regional system, and authority identifiers relevant to the record. |
| `effective` | Half-open operational interval `[from, to)`; explicit open-ended value allowed. |
| `recordedAt` | Time the platform learned this version, enabling bitemporal queries and audit. |
| `status` | Active, planned, temporary, withdrawn, closed, cancelled, superseded, or unknown. |
| `quality` | Source authority class, verification status, horizontal/vertical accuracy if published, completeness, parse warnings, and conflict state. |
| `provenance` | Field-level origin and transformations; includes manual decisions and reviewer. |
| `rawArtifactRef` | Immutable object-store pointer and digest. |
| `extensions` | Namespaced source-specific values that cannot yet be mapped without loss. |

Required authority classes are `state-authoritative`, `delegated-authoritative`, `licensed-provider`, `airport-operator`, `community`, `derived`, and `user-entered`. UI and calculations must be able to reject unsuitable classes for a given function.

## 3. Spatial and measurement primitives

- `GeoPoint`: latitude, longitude, source precision, horizontal datum, optional ellipsoidal and orthometric height.
- `GeoPath`: ordered points plus segment interpretation (`geodesic`, `rhumb`, `published-arc`, `source-polyline`, or `unknown`). Never simplify the authoritative geometry in place.
- `GeoSurface`: rings, antimeridian-safe topology, source encoding, and boundary inclusion rule.
- `Altitude`: numeric value plus unit, reference (`MSL`, `AGL`, `FL`, `SFC`, `UNL`, ellipsoid, pressure altitude, or source-defined), and inclusive/exclusive boundary.
- `VerticalLimit`: lower and upper `Altitude`, with source text retained.
- `Measure`: decimal value, UCUM-like unit code, precision, and source text.
- `Bearing`: degrees, reference (`true`, `magnetic`, `grid`), epoch/model where derived, and normalization convention.
- `TimeExpression`: UTC instant/interval, or a source expression such as `HJ`, `H24`, daylight, seasonal schedule, or prior-permission hours. Parsing must not invent an instant when the expression depends on local rules.

Canonical storage uses SI where it reduces ambiguity, but must preserve published units. Presentation and filing units are selected by jurisdiction and context, not merely by user preference.

## 4. Aerodrome and surface model

### 4.1 Aerodrome

`Aerodrome` covers airports, heliports, seaplane bases, and other landing facilities. It contains:

- ICAO location indicator, national/local identifiers, IATA code where legitimately sourced, names, and operator;
- reference point, published elevation, geoid/datum metadata, magnetic variation as published, and reference temperature where provided;
- civil/military/joint/private use, prior-permission status, certification/licensing status, customs, entry, and operating schedules;
- communication, meteorological, rescue/fire, handling, de-icing, lighting, and fuel service references;
- associated runways, helipads, movement areas, parking, charts, procedures, NOTAM scope, and source editions.

Identifiers are many-to-many and time-varying. An identifier alone is not a globally unique airport key.

### 4.2 Runway and runway direction

`Runway` models the physical strip; `RunwayDirection` models each operational direction. Required concepts include:

- designators and previous/future designators;
- centreline geometry, width, surface, strength/classification, slope, declared distances and units;
- threshold, displaced threshold, stopway, clearway, runway end, touchdown-zone elevation, lighting, markings, approach aids, and arresting systems;
- closure/restriction state and schedule;
- source-declared `TORA`, `TODA`, `ASDA`, and `LDA`, never inferred from geometry for operational use;
- runway condition observations and assessment method as separate dynamic records.

Do not merge physical length, declared distance, and available distance after a temporary NOTAM. A calculation chooses the correct, current input explicitly and shows it to the user.

### 4.3 Surface network

`SurfaceElement` represents taxiway segments, apron areas, stands, holding positions, hotspots, runway crossings, service roads, and restrictions. `SurfaceNode` and `SurfaceEdge` form a routable graph only when the source quality supports it. Geometry extracted from a raster airport diagram or community map is not silently promoted to an authoritative taxi route.

## 5. Navigation and airspace model

### 5.1 Significant point and navaid

`SignificantPoint` represents named fixes, reporting points, intersections, coordinates, and terminal waypoints. `Navaid` represents a physical or service facility (VOR, DME, NDB, TACAN, ILS component, GBAS, or source-defined type), with frequency/channel, service volume when published, magnetic variation setting, hours, status, and colocated relationships.

Duplicate identifiers are expected. Resolution requires position, region, type, effective time, and route/procedure context.

### 5.2 Route and segment

`Airway`/`ATSRoute` contains ordered `RouteSegment` records. A segment stores start/end significant points, directionality, navigation specification, minimum/published levels, upper/lower limits, route designator, distance and course as published, responsible unit, and conditional availability. Direct routes and user legs are separate types.

An airway expansion is a versioned derivation tied to a data cycle. The app must not retain an old expansion after one of its source segments changes without marking the route stale.

### 5.3 Airspace

`AirspaceVolume` contains lateral geometry, vertical limits, class/type, name/designator, controlling authority, service, communication requirements, activation schedule, and status. Volumes may be composed, nested, overlapping, or activated by NOTAM. Model at least:

- FIR/UIR, CTA, TMA, control zone, terminal/class airspace;
- prohibited, restricted, danger, warning, alert, military operations and other special-use areas;
- temporary reserved/segregated areas and temporary flight restrictions;
- advisory and flight-information regions where published;
- local constructs in a namespaced taxonomy.

ICAO letter classes are not enough to decide legality. Store the State definition and applicable local rule reference. Boundary intersection must include time and altitude, not only a 2D polygon test.

### 5.4 Procedure and chart

`Procedure` is metadata and structured legs only when sourced under a lawful, quality-controlled feed. It includes procedure type, airport/runway association, transitions, minima references, navigation specification, amendment, effective interval, and source chart.

`Chart` contains title, authority, chart type, index/coverage, edition, effective/expiry dates, revision, georeferencing, file digest, licence, and supersession chain. A chart image, its metadata, and extracted vector features are separate licensed artifacts.

Do not reverse-engineer or approximate instrument procedure coding from chart graphics for operational routing. ARINC 424 and commercial procedure datasets require their own licences.

## 6. Dynamic operational information

### 6.1 NOTAM

`Notam` preserves the complete original message and, where present, series/number/year, Q-line, location, issue time, validity, schedule, body, lower/upper limits, coordinates/radius, replacement/cancellation links, and source office. Parsed interpretations carry parser version, warnings, and confidence per field.

NOTAM scope is not reliably reducible to a point and radius. Route relevance is a ranked aid; the pilot must be able to inspect unabridged source text. ICAO defines a NOTAM as timely telecommunication of a facility, service, procedure, or hazard change essential to flight operations ([ICAO NOTAM improvement campaign](https://www.icao.int/global-campaign-notam-improvement-notam2021)).

### 6.2 Weather

Use a common `WeatherProduct` envelope with product type, source authority, raw product, observation/issue/valid times, retrieval time, correction/amendment state, location/geometry, parser version, and staleness policy. Specific records include:

- METAR/SPECI, TAF, PIREP/AIREP;
- SIGMET, AIRMET/G-AIRMET, CWA and jurisdiction-specific advisories;
- winds/temperatures aloft, radar mosaic/site data, satellite, lightning, icing/turbulence, and forecast grids.

Rendered weather must always expose source time, retrieval time, valid interval, and stale/unavailable state. A missing update is not benign weather.

### 6.3 Terrain and obstacles

`TerrainDataset` is a tiled elevation surface with horizontal/vertical datum, surface model type (DEM/DSM), resolution, void policy, acquisition/edition dates, licence, and known limitations. `Obstacle` stores position, elevation/height and references, type, lighting/marking, verification/status, effective time, and source.

Terrain and obstacle alerts must identify dataset age and coverage. Never fill a void with zero elevation or treat “no obstacle record” as “no obstacle”.

### 6.4 Magnetic and solar models

`MagneticModelEdition` stores coefficients, epoch, valid interval, model/version, checksum, altitude convention, and test vectors. `SolarEvent` is a derived value tied to algorithm/version, position, date, event definition, atmospheric assumptions, and polar-day/night state.

The current WMM2025 model is valid through 2029 and NOAA publishes coefficients, public-domain source code, limitations, and test values ([NOAA WMM](https://www.ncei.noaa.gov/products/world-magnetic-model)).

## 7. Aircraft, loading, performance, and fuel

### 7.1 Aircraft profile

`AircraftProfile` separates immutable type metadata from a user's individual aircraft configuration. It includes registration, equipment and surveillance codes, performance model reference, approved units, fuel type, tanks, loading stations, envelopes, and source documents.

Every performance datum has a provenance class:

- `approved-aircraft-document` (AFM/POH or approved supplement);
- `operator-approved`;
- `manufacturer-advisory`;
- `user-entered`;
- `generic-educational`.

Only the first two may be eligible for an operator-approved workflow, and only after jurisdiction/operator validation. The initial product ships no fabricated aircraft-specific values.

### 7.2 Loading and weight-and-balance

`LoadingStation`, `LoadItem`, `FuelTankState`, `Envelope`, and `WeightBalanceResult` preserve arm/station, weight, moment, units, interpolation method, profile revision, and warnings. Results include ramp, takeoff, landing, zero-fuel states as supported, but never assume those terms or limits apply to every aircraft.

### 7.3 Performance

`PerformanceModel` is a versioned collection of input domains, source tables/curves, interpolation rules, correction factors, prohibited extrapolation ranges, and validation fixtures. `PerformanceResult` records every input, intermediate, margin policy, result, and source revision. Takeoff/landing calculations keep runway condition, slope, wind component, pressure/density altitude, obstacle assumptions, and regulatory margin separate.

### 7.4 Fuel planning and availability

`FuelPlan` models phase burn, taxi, trip, contingency, alternate, final reserve, additional, discretionary, unusable fuel, and unit/density conversion. Reserve categories and required minima come from a jurisdiction/operator rule pack; they are not global defaults.

`FuelService` records fuel grade/type, availability statement, hours, provider/contact, self-service/ prior-arrangement state, source/effective time, and confidence. It is directory information, not a guarantee of stock, price, compatibility, or service at arrival.

## 8. Flight and route model

`FlightPlanDraft` includes operation jurisdiction(s), flight rules, aircraft/configuration snapshot, route legs, departure/destination/alternates, planned levels, time, fuel policy, weather/NOTAM briefing snapshot, and calculation revisions. It is distinct from a filed plan and from an ATC clearance.

`RouteLeg` identifies intent (`direct`, `airway`, `procedure`, `vector`, `manual`, `hold`) and retains both entered text and resolved entities. Route resolution can be `resolved`, `ambiguous`, `unsupported`, `stale`, or `invalid-for-cycle`; ambiguity always requires user action.

`BriefingSnapshot` is an auditable manifest of products actually retrieved and shown. It records coverage gaps and failures; it must not claim to be an official briefing unless a regulator-acceptable provider and workflow contract explicitly support that claim.

## 9. Jurisdiction rule packs

A versioned `JurisdictionRulePack` is selected by authority, operation category, aircraft, operator, airspace/FIR, and effective date. It may provide:

- units, level/altimeter conventions, transition rules, semicircular/cruising level logic;
- airspace class semantics, VMC minima, equipment and communication requirements;
- flight-plan addressing/format and local route constraints;
- fuel policy templates and alternate logic;
- EFB authorization, own-ship and chart requirements;
- terminology, warnings, official source links, and legal-review status.

Rules are executable only after aviation and legal approval plus fixtures from the controlling publication. Otherwise the rule pack is `informational` and the app links the user to the current authority material.

## 10. Safety invariants

- No operational record without source, effective time, retrieval time, and licence status.
- No silent source downgrade from authoritative to community or user-entered data.
- No arithmetic across unknown or incompatible units/datums.
- No route, weather, NOTAM, chart, magnetic, terrain, obstacle, or performance output without edition/model age.
- No “current” badge when freshness cannot be proven.
- No automated deletion of source warnings during parsing or normalization.
- No extrapolation of aircraft performance beyond a source-defined domain.
- No assumption that a planned route is legal, accepted, cleared, or terrain-safe.
- No assumption that a fuel listing guarantees availability.

## 11. Open decisions

1. Choose the initial operational jurisdiction; the U.S. has the clearest open official data path, while India is a strategically relevant but licensing-blocked candidate.
2. Decide whether structured procedures are Phase 1 or remain chart-only until a licensed ARINC/AIXM-quality feed is contracted.
3. Define the legal boundary between an in-app weather view and an “official briefing” in each launch jurisdiction.
4. Establish the minimum terrain/obstacle integrity and validation evidence before enabling alerts rather than passive depiction.
5. Decide whether ODbL surface data can be isolated cleanly enough for the intended offline database and distribution model.
