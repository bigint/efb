# Airport dossier

The Places workspace reads normalized airports from the active aviation-domain collection. It
shows identifier, coordinates, elevation, IANA timezone, runway geometry, source, dataset
version, retrieval/effective/expiry metadata, verification, confidence, and currency. Runway
heading is explicitly true-referenced.

Nearby airports are a pure deterministic great-circle ranking over unique active candidates. The
origin is excluded, results are distance/identifier sorted, and callers must choose a limit from
1 through 50. The current demonstration collection requests at most five.

The fictional dataset does not contain frequencies, services, fuel, operating notes, or NOTAM.
The dossier states `NOT SUPPLIED` or `NOT AVAILABLE` for each field and warns that absence does
not establish operational availability or safety. No placeholder values or current-data
implication are generated.

The dossier separately computes sunrise and sunset for the airport's current IANA-local calendar
date and displays the resulting UTC instants. The local implementation follows the
[NOAA Global Monitoring Laboratory calculator equations](https://gml.noaa.gov/grad/solcalc/calcdetails.html),
including its 0.833° atmospheric-refraction assumption, two-pass solar-noon refinement, and
Julian-day calculation. It supports exact dates from 2000 through 2099 and returns explicit
polar-day, polar-night, invalid-date, or calculation failure states. NOAA describes the
theoretical accuracy as approximately one minute within ±72° latitude and ten minutes beyond,
while warning that real atmospheric conditions can shift observed events. The UI therefore calls
the result a computed astronomical estimate and never derives legal day/night, runway-lighting,
or airport-availability status.

Authoritative ingestion, runway declared distances, weather linkage, solar-event independent
authority fixtures, favourite-only filtering, dataset-scale spatial indexing, native adaptive
layout, and accessibility evidence remain open.
