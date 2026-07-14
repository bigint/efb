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
receipt timestamp and considers adjacent UTC months. Weather retrieval, caching, expiry,
flight-category classification, TAF decoding, runway visual range, international metre
visibility, weather-code semantics, and complete briefing UI are not yet credited as
implemented. The mobile workspace can retrieve a single bounded raw TAF from AWC, but it does
not parse or evaluate any forecast group, issue time, validity window, amendment, or currency
state.
