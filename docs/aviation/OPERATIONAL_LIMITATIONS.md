# Operational limitations and safety posture

Status: mandatory initial-release constraints Applies to: all product copy, onboarding, map,
planning, weather, airport, performance, and in-flight views

## 1. Intended use

The initial application is intended for:

- flight simulation;
- pilot education;
- pre-flight planning assistance; and
- non-certified, supplemental situational awareness.

It is **not** approved or intended as a primary navigation instrument, installed avionics,
terrain awareness and warning system, official weather briefing service, dispatch system,
flight-plan filing service, or replacement for required/current aeronautical information. It
does not provide an ATC clearance or determine that a flight is legal or safe.

This limitation is architectural, not a disclaimer that can be removed after UI polish. FAA AC
120-76E describes an operator programme needed to replace required paper for covered operators,
including equivalent accessibility, usability, and reliability
([FAA AC 120-76E](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1042829)).
EASA and UK CAA guidance similarly distinguish portable/installed equipment and operational
approval
([EASA AMC 20-25A](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-acceptable-means-2?page=19),
[UK CAA EFB guidance](https://www.caa.co.uk/commercial-industry/aircraft/airworthiness/aircraft-equipment/electronic-flight-bags/)).
Installing this app does not satisfy those processes.

## 2. Non-negotiable user-facing statement

On first use, after material scope changes, and from an always-available About/Safety screen:

> For planning, education, simulation, and supplemental situational awareness only. Not approved
> for primary navigation or as a substitute for current official charts, NOTAMs, weather,
> aircraft documents, ATC instructions, or required flight planning. Verify all operational
> information with the applicable authority and approved sources.

Do not weaken this with phrases such as “FAA approved,” “certified navigation,” “official
briefing,” “guaranteed terrain clearance,” or “all NOTAMs” unless the exact function later earns
and maintains that status.

## 3. Function limits

### Navigation and own-ship

- GPS position, course, speed, altitude, heading, and accuracy may be missing, stale, delayed,
  spoofed, jammed, magnetically disturbed, or degraded by device location and antenna geometry.
- Consumer GNSS/barometer/magnetometer data is advisory. Do not use device altitude for terrain,
  obstacle, airspace, or approach compliance claims.
- Own-ship may appear only on layers known to be georeferenced. Never overlay it on an
  unreferenced chart/diagram in a way that suggests precision.
- Show sensor source, age, accuracy/integrity state, and a prominent `POSITION UNRELIABLE` or
  `NO POSITION` state. Freeze must never look live.
- Route sequencing, direct-to, cross-track error, and ETA are aids, not steering commands or
  clearance amendments.
- Synthetic/simulator position must use a persistent, unmistakable simulation treatment and
  cannot silently become live.

### Charts and static data

- Every chart/data package shows authority, edition/cycle, effective and expiry dates,
  download/verification state, and coverage.
- Expired data remains accessible only with a strong expired state when needed for
  simulation/history; it cannot masquerade as current operational data.
- A current AIRAC dataset does not include all temporary change. Users must check current NOTAM,
  AIP supplements, chart notices, and authority corrections.
- Data errors can exist in official products. FAA publishes safety alerts and product notices,
  including corrections to NASR and terminal products
  ([FAA safety alerts](https://www.faa.gov/air_traffic/flight_info/aeronav/safety_alerts/));
  ingestion must support urgent corrections and revocation.
- Community data cannot silently replace missing official data. It must be labelled by source
  and unsuitable for operational decisions.

### NOTAM

- Route relevance and parsing are fallible. Preserve and expose original text, source,
  issue/retrieval/validity times, cancellation/replacement links, and parse warnings.
- Do not claim completeness when the feed, request, location mapping, time window, or
  jurisdiction is unknown or failed.
- Do not suppress a NOTAM solely because a parser could not classify it. Put unparsed records in
  a visible review group.
- Schedules such as daily windows, estimated end times, daylight-relative activation, and
  exceptions require explicit handling; uncertain interpretation stays uncertain.
- The FAA public WFS documentation currently describes a demo service, not a production
  commitment ([FAA NOTAM WFS](https://notams.aim.faa.gov/notamWFS/)). A production launch needs
  a contracted/operational feed and monitored coverage.

### Weather

- Every product shows source, observation/issue time, valid interval, retrieval time, and
  staleness. Radar/satellite animation frames show individual times.
- Missing, delayed, stale, unavailable, and outside coverage are distinct from “no weather.”
- Decoding is an aid; raw METAR/TAF and advisory text stays available.
- Weather mosaics, forecasts, radar, lightning, turbulence, icing, and pilot reports have
  different latency, coverage, resolution, and predictive meaning. Do not combine them into a
  single implied truth state.
- The NOAA/AWC API is rate limited and advises load-conscious use; a backend cache, monitoring,
  and fallback are required ([AWC API](https://aviationweather.gov/data/api/)).
- A weather display is not automatically an official briefing or proof that all applicable
  products were reviewed.

### Terrain, obstacles, and airspace

- Initial terrain/obstacle/airspace functions are passive or advisory only; do not use `TAWS`,
  `HTAWS`, `GPWS`, `terrain clearance assured`, or certified alert symbology claims.
- DEM/DSM cells, vertical datums, obstacle files, and GNSS altitude are not interchangeable.
  Voids and unknown datum are unsafe inputs, not zero.
- Obstacles may be unreported, unverified, recently constructed, or below a reporting threshold.
  FAA states its DOF scope and dependence on timely reporting
  ([FAA DOF FAQ](https://www.faa.gov/air_traffic/flight_info/aeronav/obst_data/doffaqs/)).
- Airspace status may depend on time, altitude reference, NOTAM activation, ATC clearance,
  equipment, flight rules, and local procedures. A polygon intersection is not a legality
  decision.
- Alert suppression due to stale/missing coverage must itself be visible.

### Airport, runway, taxiway, and fuel

- Airport diagrams and community surface geometry do not provide taxi clearance. Never generate
  authoritative-sounding taxi instructions.
- Runway geometry, published length, declared distances, and temporarily available distances are
  separate. Do not infer TORA/TODA/ASDA/LDA from a map line.
- Runway condition and braking reports are time-sensitive and method-specific.
- Fuel/service listings are directory information. Show source, age, hours/arrangement text, and
  contact where licensed; require user confirmation of grade, stock, compatibility, price, and
  opening.

### Aircraft performance, weight and balance, and fuel planning

- Ship no fabricated aircraft-specific values. Generic profiles and worked examples are
  educational only.
- Aircraft calculations require the correct current AFM/POH/supplement or operator-approved
  source for that exact aircraft/configuration.
- Preserve units and every input. Reject missing inputs and extrapolation outside source tables;
  do not invent a “conservative” result without a validated method.
- Results do not account for every pilot technique, aircraft condition, runway contamination,
  obstacle, regulation, or operational margin.
- Fuel reserve and alternate policies vary by jurisdiction, operation, aircraft, and operator.
  The user must select a reviewed policy; there is no global default.
- Weight-and-balance output does not prove items are secured, actual weights are correct, fuel
  is usable, or loading complies with all aircraft limitations.

## 4. Device and cockpit limits

- The pilot/operator remains responsible for a usable mount or stowage, power, thermal
  management, glare, accessibility, and backup appropriate to the operation.
- The app must recover predictably after background suspension, OS termination, low-memory
  eviction, sensor permission changes, interrupted downloads, and loss of network/GPS.
- Low battery, thermal throttling, insufficient storage, corrupted package, clock error, and
  data expiry require proactive warnings.
- Do not cover required flight controls/displays or encourage interaction during high-workload
  phases. Controls need turbulence-sized targets and reversible actions.
- Transmitting radios and portable-device use are governed by aircraft/operator/authority rules.
  Flight mode and Bluetooth/Wi-Fi behaviour cannot be assumed lawful in all phases.
- A single tablet is a single point of failure. The initial product does not define an approved
  backup strategy.

## 5. Jurisdiction and operator limits

- The app must know which jurisdiction profile is active and expose it. If none is reviewed,
  show general information and current authority links rather than calculated compliance.
- State AIP differences, local rules, operator procedures, aircraft documents, and ATC
  instructions override app defaults.
- Commercial operators may need authority-specific approval, administration, training, risk
  assessment, database control, hardware evaluation, backup, and change management.
- India specifically has a DGCA EFB specific-approval framework (CAR Section 8 Series S Part
  VIII and CAP 8600), while the precise applicability to this product/operation must be
  confirmed against current official documents before any operational claim.

## 6. Staleness and failure policy

| State                                  | Required behaviour                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Current and verified                   | Show source and effective/valid time; normal presentation.                                                                |
| Near expiry                            | Persistent countdown/notice and update action; no silent auto-dismissal.                                                  |
| Expired                                | Block operational mode for that layer/function or show a dominant expired treatment; allow simulation only when explicit. |
| Retrieval failed but cached data valid | Show failure and last successful retrieval; continue only within documented validity.                                     |
| Stale dynamic data                     | Remove live animation/colour implication, show age and unavailable-refresh state.                                         |
| Outside coverage                       | Hide precision claims and say which dataset/layer has no coverage.                                                        |
| Integrity/checksum failure             | Quarantine package and fall back only to another independently verified, licensed source.                                 |
| Conflicting sources                    | Display conflict and selected-source rationale; do not merge safety-critical values automatically.                        |

Device time is not sufficient proof of currency. Package manifests use signed source metadata,
effective intervals, trusted server retrieval time, and cryptographic hashes.

## 7. Human factors protections

- Critical warnings use text plus shape/icon, not colour alone, and work in day, night, and
  high-contrast modes.
- Warnings state the condition and next safe action; avoid alarm-like urgency for non-actionable
  informational issues.
- Acknowledgement does not erase an unresolved condition.
- Units and north reference are visible at the point of use. Mixed true/magnetic or MSL/AGL/FL
  values receive explicit labels.
- Destructive route edits and mode changes are undoable. Accidental long-press or turbulence
  taps must not issue irreversible actions.
- Avoid false precision: round to the source/input capability and show uncertainty when
  published.

## 8. Release blockers

The initial flight-aware release is blocked until all of these are true:

1. source and licence registry covers every shipped data artifact;
2. current/next-cycle activation, expiry, rollback, urgent correction, and corruption paths are
   tested;
3. offline coverage and missing-layer behaviour are verified on real target devices;
4. raw and decoded weather/NOTAM time semantics are tested at boundary cases;
5. live versus simulation state cannot be confused;
6. sensor loss, stale position, background recovery, thermal, power, and storage failures have
   cockpit-readable states;
7. no copy or UI implies certification, official briefing, filing, clearance, guaranteed fuel,
   or guaranteed terrain/airspace avoidance;
8. aviation-domain review signs off on the selected jurisdiction and scenarios;
9. legal review signs off on data rights, disclaimers, privacy, and launch claims; and
10. the store listing, onboarding, support material, and screenshots carry the same safety scope
    as the app.

## 9. Path to broader operational use

Future approval is a separate programme: define intended functions and operators; contract
suitable data; build controlled administration and change processes; perform
safety/human-factors assessments; validate hardware, mounts, power, EMI and backups; document
training and procedures; and engage the applicable authority. Approval of one operator,
function, device, or jurisdiction must not be generalized to another.
