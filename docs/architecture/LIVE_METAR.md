# Live AWC METAR and raw TAF retrieval

## Provider and scope

The Weather workspace can request one latest raw METAR or TAF from the NOAA/NWS Aviation Weather
Center Data API using `GET /api/data/metar?format=raw&ids=STATION` and
`GET /api/data/taf?format=raw&ids=STATION`. The API is a worldwide machine-to-machine weather
source. This integration does not retrieve PIREPs, SIGMETs, NOTAMs, winds aloft, radar, or a
route briefing.

The request is initiated by an explicit user action. There is no polling, background retrieval,
or persisted weather cache. React Native's native networking is the supported runtime; AWC
documents that browser cross-origin requests are not permitted, and the existing web build is
not a validation surface.

## Request policy

- Station input is exactly four uppercase alphanumeric characters before URL construction.
- Product endpoints and `format=raw` are fixed; arbitrary URLs and query values are not
  accepted.
- Requests send a Driftline user-agent and request plain text.
- One client instance enforces at least 60 seconds between attempts across stations and across
  METAR/TAF, including failed attempts, matching AWC's per-thread guidance.
- An abort signal limits a request to 10 seconds.
- HTTP 204, 429, other provider errors, timeouts, and invalid clocks remain distinct failures.

## Response boundary

Only one non-empty raw line up to 4,096 characters is accepted. The existing conservative METAR
parser must resolve a station and UTC observation time, and the returned station must equal the
requested station. Unsupported body groups remain visible instead of being guessed.

A TAF response may contain at most 64 non-empty lines and 8,192 characters. It must contain
exactly one TAF header, at the start of the response, for the requested station. Control
characters outside normal whitespace are rejected. Forecast groups, issue time, validity period,
amendments, and currency are not interpreted; the UI displays source-verified raw text and
explicitly says validity is not evaluated.

Successful data carries explicit AWC source, retrieval time, observation source time, API model
version, worldwide jurisdiction, real origin, and source-verified status. Product currency uses
the observation time and a one-hour validity limit. A future or stale observation renders
unavailable even when the network request itself succeeded.

A failed refresh does not erase the prior decoded observation. Its original retrieval and
currency metadata remain visible while the new failure is reported, so update failure cannot be
mistaken for successful replacement.

## UX and safety

The live card says `SUPPLEMENTAL WEATHER ONLY`, states the no-cache and shared
one-request-per-minute limit, and does not call either result a briefing. Decoded METAR output
displays source and retrieval UTC alongside observation UTC. Raw TAF output is visually
separated from decoded observations. Manual pasted reports remain unverified and
currency-unknown.

## Verification boundary

Unit tests use an injected fetcher and clock to cover METAR and TAF success, shared throttling,
no data, provider throttling, timeout, clock reversal, station mismatch, invalid identifiers,
and multiple-report bodies. Direct HTTPS smoke requests to the documented endpoints returned
current raw METAR and multiline TAF reports on 2026-07-14. Native network loss, captive portals,
TLS interception, app lifecycle, physical-device rendering, provider schema changes, forecast
decoding, and briefing completeness remain release blockers.
