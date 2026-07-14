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
has currency recomputed against the current clock. TAF parsing is deliberately limited to header
amendment state, issue time, and a resolved UTC validity window; current/not-yet-valid/expired
is recomputed on display. Forecast change groups and their weather semantics remain raw and
uninterpreted.

Decoded METAR output may also derive a display-only flight category using the published U.S. NWS
ceiling and statute-mile visibility thresholds. The classifier uses the worse of the lowest
parsed `BKN`, `OVC`, or `VV` ceiling and parsed visibility, preserves visibility-bound evidence,
and returns unavailable when either required input is missing or ambiguous across category
boundaries. This is explicitly a U.S. threshold aid, not a worldwide regulatory classification
or a substitute for a complete observation or briefing.

Background retrieval, briefing completeness, full TAF decoding, runway visual range,
international metre visibility, weather-code semantics, and operational weather availability are
not yet credited as implemented.
