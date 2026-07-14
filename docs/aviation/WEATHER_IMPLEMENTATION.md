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
is recomputed on display. A separate conservative timeline pass recognizes `FM`, `TEMPO`,
`BECMG`, `PROB30`, `PROB40`, and combined probability/temporary markers, resolves their explicit
UTC points or periods within the header validity, and preserves each following condition body as
raw text. It does not interpret wind, visibility, weather, or cloud meaning inside those bodies,
and malformed/out-of-window markers make the timeline unavailable while the complete raw TAF
remains visible.

METAR currency and TAF validity fail closed unless provenance is source-verified or
cross-checked and the origin is real. A time-bounded but unverified or simulated report
therefore cannot acquire the same `CURRENT` state as retrieved source weather.

Decoded METAR output may also derive a display-only flight category using the published U.S. NWS
ceiling and statute-mile visibility thresholds. The classifier uses the worse of the lowest
parsed `BKN`, `OVC`, or `VV` ceiling and parsed visibility, preserves visibility-bound evidence,
and returns unavailable when either required input is missing or ambiguous across category
boundaries. This is explicitly a U.S. threshold aid, not a worldwide regulatory classification
or a substitute for a complete observation or briefing.

A progressively disclosed density-altitude tool can combine a current source-verified decoded
temperature and altimeter setting with a user-entered published field elevation. It uses the
separately documented FAA rule-of-thumb approximation, displays its intermediate pressure
altitude and ISA temperature, and fails closed outside bounded educational inputs. It is not an
aircraft-specific performance calculation or runway decision.

Background retrieval, briefing completeness, full TAF condition decoding, runway visual range,
international metre visibility, weather-code semantics, and operational weather availability are
not yet credited as implemented.
