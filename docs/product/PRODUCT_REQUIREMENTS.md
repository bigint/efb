# Driftline product requirements

## Product definition

**Working name:** Driftline

Driftline is an original, offline-first electronic flight bag for flight simulation, pilot
education, pre-flight planning, and non-certified situational awareness. The working name and
visual identity require trademark and legal clearance before public release.

Driftline is not a primary navigation instrument, does not replace required charts or equipment,
and does not imply operational approval. FAA AC 120-76E describes an operator programme,
evaluation, training, reliability, and authorization context far beyond merely shipping an app.
EASA requirements are also operational- and application-class-specific. The initial product
therefore uses persistent, plain-language limitations and avoids certified-instrument visual
treatment.

## Intended users and contexts

1. Student and qualified pilots preparing a flight away from the aircraft.
2. Simulator pilots learning route, weather, and aircraft-planning concepts.
3. Pilots using a portable device as a supplemental, non-certified awareness aid where local
   rules and operator procedures permit.
4. Instructors demonstrating calculations, failure modes, and planning choices.

Out of scope for the initial release: dispatch release, operational approval, certified
navigation, primary terrain or traffic alerting, automatic flight control, filing flight plans,
and authoritative aircraft-specific performance.

## Product principles

- **Truth before convenience:** source, age, confidence, simulation state, and missing data stay
  visible.
- **Plan offline:** downloaded maps, airports, routes, aircraft, documents, and calculations
  remain usable without a server.
- **Degrade loudly:** GPS loss, stale weather, corrupt data, and sensor disagreement change both
  presentation and available actions.
- **Keep intent reversible:** route edits preview before replacement; downloads use atomic
  swaps; destructive actions require confirmation and undo where practical.
- **One canonical calculation:** critical formulae live in framework-independent packages, use
  typed units, and are not duplicated in UI code.
- **Jurisdiction is data:** regulatory or data-source assumptions are explicit inputs, never
  inferred silently from locale.

## Primary journeys

### Prepare

Select aircraft and jurisdiction, confirm dataset currency, inspect airport and weather
provenance, build a route, choose altitude and alternate, review time and fuel, then save an
immutable planning snapshot plus later edits.

### Navigate in simulation

Start a clearly marked simulation, load a route, view map and navigation data, exercise
direct-to and route changes, and inject position/sensor/weather faults. Every screen displays
simulated source status.

### Use offline

Select a geographic pack, review size/expiry, download with resumable progress, verify checksum,
activate atomically, disable connectivity, and complete airport search, route creation, document
access, and simulation.

### Assess aircraft loading

Choose a generic demonstration profile, enter stations and fuel with explicit units, view
mass/CG states and limits, save a scenario, and distinguish generic educational output from
approved aircraft data.

## Release-one functional requirements

The first navigable slice shall provide adaptive iPhone/iPad shells, day/night themes, a native
map surface, a local airport fixture dataset, indexed airport search and detail, route creation
and display, deterministic distance/bearing/ cross-track calculations, simulator position,
persistent local user state, source/age status, and automated tests.

The fixture dataset must be conspicuously labelled demonstration data and enter through the same
validated adapter boundary intended for licensed production data. No completed control may be a
placeholder.

## Non-functional gates

- Strict TypeScript and explicit units; malformed external values fail closed.
- Ordinary GA route recalculation target below 250 ms and local airport query target below 100
  ms, measured on defined reference hardware and fixtures.
- A 60 fps map interaction target on a recent iPad, measured in a development build with
  profiling disabled for the release measurement.
- No operationally significant status communicated by colour alone.
- Interactive cockpit controls target at least 48 by 48 points, exceeding the normal iOS/iPadOS
  default control size to accommodate vibration and mounting.
- Critical actions have non-gesture alternatives; split view, rotation, Dynamic Type, VoiceOver,
  keyboard, and pointer are acceptance-test dimensions.
- Application recovery tests cover process death during navigation and dataset activation.

## Data confidence contract

Operationally relevant view models shall carry source identifier, source time, retrieval time,
effective interval, expiry, dataset version, confidence, verification state, jurisdiction, and
real/simulated/derived origin. Absence of a field is an explicit unknown state, not an
invitation to synthesize a value.

## Success measures

- A new user can create and simulate a short route offline without training.
- Test pilots identify real versus simulated position and fresh versus stale weather correctly
  in every moderated task.
- No critical calculation has an untyped numeric interface or an unreferenced formula.
- Dataset rollback and corrupted-cache recovery complete without losing user flights.
- Each phase has build, test, performance, accessibility, offline, and safety evidence before
  status changes to complete.

## Primary references

- [FAA AC 120-76E — Authorization for Use of Electronic Flight Bags](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1042829)
- [EASA Easy Access Rules for Air Operations, revision 24](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations)
- [Apple: Designing for iPadOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados)
- [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility)
