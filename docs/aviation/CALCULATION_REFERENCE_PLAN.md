# Calculation reference and validation plan

Status: Phase 0 implementation contract Goal: make every navigation, atmospheric, solar,
loading, and performance result reproducible, reviewable, and jurisdiction-aware

## 1. Policy

No calculation enters production from an informal formula copied into UI code. Each calculation
requires:

1. a named intended use and safety classification;
2. authoritative or peer-reviewed references and any required licence;
3. an input/output contract including units, datum, time standard, north reference, valid
   domain, uncertainty, and missing-value policy;
4. an independent implementation or trusted library selected through dependency review;
5. authoritative examples plus independent golden vectors;
6. property, boundary, unit, and numerical-stability tests;
7. domain review and a versioned calculation ID included in saved results; and
8. explicit behaviour outside the validated domain.

ICAO publications define many operational concepts but are copyrighted and often purchased;
citing a title is not permission to copy tables or redistribute content. ARINC 424, RTCA,
EUROCAE, aircraft manuals, and commercial performance data likewise require legitimate access
and rights.

## 2. Calculation registry

Every implementation registers:

| Field           | Requirement                                                                         |
| --------------- | ----------------------------------------------------------------------------------- |
| `calculationId` | Stable name plus semantic version.                                                  |
| `intendedUse`   | Display, advisory planning, simulation, or approved-workflow candidate.             |
| `references[]`  | Document/version/section or software/model/version and licence record.              |
| `inputSchema`   | Units, datum/reference, precision, allowed range, null/unknown policy.              |
| `outputSchema`  | Units/reference, rounding only at presentation, uncertainty/flags.                  |
| `algorithm`     | Equations/pseudocode, numeric type, iteration/tolerance, chosen branch conventions. |
| `fixtures[]`    | Reference vectors, expected tolerance, fixture provenance.                          |
| `review`        | Aviation, engineering, QA, and when needed legal approval.                          |
| `limitations`   | Singularities, extrapolation, sensor/data quality and operational disclaimers.      |

Use IEEE 754 double precision for core geospatial/atmospheric calculations unless profiling
proves another representation safe. Use decimal or integer minor units where exact fuel/mass
entry and summation require it. Round only at boundaries and presentation.

## 3. Reference plan by family

| Family                                     | Proposed reference/implementation                                                                                                                                                                                              | Validation evidence                                                                                                                      | Initial disposition                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| WGS 84 ellipsoidal inverse/direct geodesic | GeographicLib/Karney implementation under its permissive licence; verify dependency licence/version. WGS 84 parameters from an authoritative geodetic source.                                                                  | GeographicLib test data, antipodal/nearly coincident/polar/antimeridian cases, inverse-direct round trips.                               | Implement for route distance and true initial/final bearings.                     |
| Great-circle educational model             | Explicit spherical equations with a documented radius only for education/low-stakes comparison.                                                                                                                                | Compare against ellipsoidal solution over global fixtures; show expected error.                                                          | Never silently use for operational route distance.                                |
| Rhumb line                                 | GeographicLib rhumb implementation or a reviewed equivalent with ellipsoidal support.                                                                                                                                          | Constant-bearing properties, pole/antimeridian cases, round trips.                                                                       | Implement only where user selects/published leg requires it.                      |
| Cross-track and along-track                | Ellipsoidal geodesic-line projection, not an undocumented spherical shortcut.                                                                                                                                                  | On-leg zero, before/after endpoints, long legs, antimeridian, high latitude, sign convention.                                            | Advisory navigation; document leg-clamping policy.                                |
| Polygon/airspace intersection              | Robust antimeridian-safe geospatial library plus altitude/time interval evaluation.                                                                                                                                            | Holes, shared boundaries, touching versus crossing, polar geometries, lower/upper equality, active schedules.                            | Implement for awareness, not legality.                                            |
| Nearest search                             | Spatial index candidate generation followed by ellipsoidal distance.                                                                                                                                                           | Compare exhaustive search, dateline and polar fixtures, duplicate coordinates.                                                           | Implement.                                                                        |
| Bearings and north references              | True bearing from geodesic; magnetic conversion with WMM edition/date/location/height.                                                                                                                                         | NOAA WMM official test values and sign-convention tests.                                                                                 | Implement true first; magnetic only with current verified WMM.                    |
| Magnetic variation                         | NOAA WMM2025 coefficients and public-domain reference code; current model valid through 2029 ([NOAA WMM](https://www.ncei.noaa.gov/products/world-magnetic-model)).                                                            | Official WMM test values, altitude reference conversion, epoch endpoints, blackout/uncertainty regions.                                  | Implement with model expiry and uncertainty state.                                |
| Wind triangle                              | Reviewed vector solution in a declared true/magnetic reference; detect no-solution/headwind cases.                                                                                                                             | Cardinal winds, calm, pure crosswind/headwind/tailwind, infeasible TAS, quadrant/property tests.                                         | Implement for planning.                                                           |
| Time/speed/distance and ETE/ETA            | Dimensional equations over geodesic distance and phase-specific groundspeed; UTC internally.                                                                                                                                   | Unit invariants, zero/negative rejection, midnight/date-line/DST presentation.                                                           | Implement; ETA is not a slot/clearance.                                           |
| Fuel burn                                  | Phase integration over time/distance from an explicit aircraft model; density conversion temperature/source-aware.                                                                                                             | Conservation and unit properties, tank capacity/unusable fuel boundaries, known model fixtures.                                          | Generic educational model first.                                                  |
| Pressure altitude                          | Reviewed standard-atmosphere relation using source altimeter setting, elevation/indicated altitude and stated units. FAA handbooks may explain pilot-facing concepts, but implementation reference must name edition/equation. | Standard-day, unit round trips, high/low setting range, compare trusted calculator.                                                      | Educational/advisory until aviation review.                                       |
| ISA atmosphere and density altitude        | ICAO Standard Atmosphere equations or an openly implementable authoritative equivalent; explicit tropospheric domain and humidity assumption.                                                                                  | Layer boundaries, standard sea level, hot/high/cold cases, independent implementation.                                                   | Advisory; label model/assumptions.                                                |
| Mach/TAS/CAS/EAS conversions               | Compressible-flow equations with domain/air-data assumptions; source from recognized flight mechanics/authority material.                                                                                                      | Known reference tables, subsonic domain boundaries, unit/property tests.                                                                 | Defer unless product workflow needs them.                                         |
| Sunrise/sunset/twilight                    | Implement a documented astronomical algorithm locally; validate against U.S. Naval Observatory data services ([USNO data services](https://aa.usno.navy.mil/data/)). Define upper-limb/refraction and twilight angle.          | Global seasonal fixtures, leap years, polar day/night, date-line and timezone presentation.                                              | Implement as informational; do not call local service at runtime.                 |
| Weight and balance                         | Exact summation of weight and moment; CG from moment/weight; envelope interpolation defined per aircraft source.                                                                                                               | Hand-worked fixtures, zero/negative/missing rejection, unit invariants, envelope boundary equality.                                      | Generic framework; aircraft-specific use requires approved data.                  |
| Takeoff/landing interpolation              | Model tables/curves and method from exact AFM/POH/operator source, including rounding, corrections, and prohibited extrapolation.                                                                                              | Digitally transcribed source fixtures, independent hand checks across every cell/breakpoint, monotonicity only where source supports it. | No bundled aircraft-specific values in initial release.                           |
| Climb/cruise/descent profile               | Source-specific phase integration and interpolation; winds vary by position/level/time.                                                                                                                                        | Known profile examples, mass/temperature/altitude boundaries, integration-step convergence.                                              | Generic extensible model first.                                                   |
| Runway wind components                     | Vector projection using runway direction in the correct true/magnetic reference and wind convention.                                                                                                                           | Cardinal and boundary angles, variable wind, magnetic epoch/source mismatch.                                                             | Implement but show assumptions; gust/crosswind limits remain aircraft/pilot data. |
| Runway slope                               | Elevation change over declared horizontal distance with source definition.                                                                                                                                                     | Direction reversal, zero length, published examples.                                                                                     | Display/assist only; never derive when endpoint datum is unknown.                 |
| Terrain corridor sampling                  | Conservative sampling tied to DEM resolution, route geometry, vertical datum, and interpolation method.                                                                                                                        | Synthetic spikes/voids, tile seams, dateline, datum conversions, compare exhaustive raster traversal.                                    | Research only until safety target and data integrity are approved.                |

## 4. Coordinate, altitude, and time conventions

- Canonical geographic coordinates are decimal degrees on an explicitly declared datum; WGS 84
  is preferred but never assumed from absent metadata.
- Normalize longitude for storage, but preserve source representation and make geometry
  operations antimeridian-aware.
- Bearings normalize to `[0, 360)` degrees; calculations state true/magnetic/grid. A magnetic
  bearing is invalid without model/published variation and epoch context.
- Distinguish ellipsoidal height, orthometric elevation, MSL as published, AGL, pressure
  altitude, and flight level. Datum conversion requires a named geoid model and coverage.
- UTC is canonical. Preserve source time precision and qualifiers; local time is
  presentation-only with a named IANA timezone and fold/gap handling.
- Intervals are half-open unless a controlling aviation source explicitly defines boundary
  inclusion differently; that exception is tested.

## 5. Detailed navigation test corpus

The baseline corpus must include:

- coincident points and sub-metre separation;
- nearly antipodal points where Vincenty-style algorithms may fail;
- equator, prime meridian, both poles, and antimeridian crossings;
- long east/west legs at high latitude;
- a closed route whose summed signed turns and intersections are known;
- airway and airspace geometries containing arcs, holes, shared edges, and composed volumes;
- waypoint identifiers duplicated in different regions;
- magnetic conversion at WMM official test positions, heights, dates, and model expiry;
- cross-track sign and magnitude on both sides of a leg and beyond each endpoint.

Acceptance tolerances are set per intended use and reference accuracy, not chosen merely to make
tests pass.

## 6. Atmospheric and wind contract

Inputs must state:

- pressure type (station/QNH/altimeter setting/standard) and unit;
- temperature source/time and whether dew point/humidity is used;
- altitude/elevation reference;
- wind direction convention (`from`) and north reference;
- steady wind versus gust/range and forecast level/time; and
- aircraft airspeed definition.

If wind exceeds the aircraft's achievable horizontal airspeed for the desired track, the solver
returns `no-solution`; it must not clamp to a plausible heading. Calm and variable wind are
modelled explicitly.

## 7. Performance-data transcription plan

Before any specific aircraft profile ships:

1. prove the right to encode and distribute the source data;
2. identify aircraft model, serial/configuration applicability, document number/revision, units,
   and supplements;
3. have two people independently transcribe data or use a verified extraction with visual
   comparison;
4. encode table/curve domains and source-prescribed interpolation/correction order;
5. prohibit extrapolation by default;
6. build boundary and representative fixtures independently checked against the document;
7. show inputs, source revision, assumptions, corrections, and margins in the result;
8. support withdrawal when a manual/supplement changes; and
9. obtain aviation review and, for operator use, operator/authority approval.

Generic sample profiles must use invented but physically coherent data, be named
`EDUCATIONAL EXAMPLE`, and be impossible to confuse with a real registration/type.

## 8. Jurisdiction-specific calculations

These are not core math and belong in reviewed rule packs:

- VFR visibility/cloud minima;
- cruising levels and transition logic;
- fuel reserve/alternate minima;
- flight time/fuel rounding rules;
- regulatory takeoff/landing margins;
- obstacle/terrain clearance criteria;
- airspace entry/equipment/communication requirements;
- daylight definitions where a rule uses local sunset/sunrise; and
- flight-plan field validation and addressing.

The calculation engine accepts an explicit rule-pack ID and effective date. With no approved
pack, it may calculate physical quantities but must not return `legal`, `compliant`, or
`approved`.

## 9. Dependency and licensing gates

- Record software licence, version, source, checksum, maintenance status, and platform
  behaviour.
- Do not copy standards text, proprietary test tables, ARINC coding, or aircraft-manual data
  without rights.
- Keep test vectors whose licences permit repository inclusion; otherwise store reproducible
  internal references in controlled systems.
- Prefer a small audited core over multiple libraries that disagree on coordinate, unit, or
  bearing conventions.
- Pin model/data editions separately from application releases so WMM and geoid updates can be
  validated and deployed safely.

## 10. Verification pipeline

For every change:

1. schema/unit validation;
2. reference-vector tests;
3. property and metamorphic tests (round trips, symmetry where valid, scale/unit invariants);
4. boundary and invalid-domain tests;
5. comparison to an independent implementation;
6. deterministic cross-platform fixtures on JavaScript and any native implementation;
7. performance test against mobile budgets; and
8. aviation reviewer approval for safety-significant version changes.

Shadow-compute old and new versions over a large route/profile corpus before activation.
Classify every delta; do not accept aggregate error metrics that hide boundary regressions.

## 11. Open research items

- Select and licence the exact geodesic/rhumb library for React Native/native modules.
- Select a geoid model and confirm global redistribution rights before any MSL/ellipsoid
  conversion.
- Obtain current, legitimate copies of applicable ICAO/RTCA/EUROCAE/ARINC standards for internal
  engineering reference.
- Define calculation assurance levels tied to product modes and future operator approval
  ambitions.
- Decide whether terrain advisory work should remain out of scope until a dedicated safety
  assessment.
- Select the first real aircraft only after permission to encode its current approved data.
