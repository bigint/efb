# Weather implementation boundary

The first weather package is a conservative METAR/SPECI adapter, not a complete weather briefing
system. It follows the group ordering and body concepts documented by the U.S. National Weather
Service in the
[Surface Weather Observing Handbook](https://www.weather.gov/media/surface/WSOH8.pdf) and the
[Aviation Weather Center data guide](https://aviationweather.gov/help/data/).

Implemented decoding is deliberately limited to report kind, station, UTC day/time, U.S. knot
wind groups, variable wind range, statute-mile visibility, CAVOK, sky condition, temperature and
dewpoint, altimeter settings, present-weather code preservation, and raw remarks. Unsupported
groups remain in `unparsedBodyGroups`; they are never silently discarded or turned into an
operational value.

The raw report and provenance remain attached. Observation day resolution requires a trusted
receipt timestamp and considers adjacent UTC months. The mobile workspace can retrieve one
latest METAR or bounded raw TAF from AWC and retains successful raw products in a small,
timestamped SQLite cache. Cache reads revalidate and reparse their source text; a cached METAR
has currency recomputed against the current clock, while cached TAF validity remains explicitly
unevaluated. Background retrieval, briefing completeness, flight-category classification, TAF
decoding, runway visual range, international metre visibility, weather-code semantics, and
operational weather availability are not yet credited as implemented.
