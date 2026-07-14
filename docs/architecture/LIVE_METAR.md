# Live METAR retrieval

## Provider and scope

The Weather workspace can request one latest raw METAR from the NOAA/NWS Aviation Weather Center
Data API using `GET /api/data/metar?format=raw&ids=STATION`. The API is a worldwide
machine-to-machine weather source. This integration does not retrieve TAFs, PIREPs, SIGMETs,
NOTAMs, winds aloft, radar, or a route briefing.

The request is initiated by an explicit user action. There is no polling, background retrieval,
or persisted weather cache. React Native's native networking is the supported runtime; AWC
documents that browser cross-origin requests are not permitted, and the existing web build is
not a validation surface.

## Request policy

- Station input is exactly four uppercase alphanumeric characters before URL construction.
- The endpoint and `format=raw` are fixed; arbitrary URLs and query values are not accepted.
- Requests send a Driftline user-agent and request plain text.
- One client instance enforces at least 60 seconds between attempts across stations, including
  failed attempts, matching AWC's per-thread guidance.
- An abort signal limits a request to 10 seconds.
- HTTP 204, 429, other provider errors, timeouts, and invalid clocks remain distinct failures.

## Response boundary

Only one non-empty raw line up to 4,096 characters is accepted. The existing conservative METAR
parser must resolve a station and UTC observation time, and the returned station must equal the
requested station. Unsupported body groups remain visible instead of being guessed.

Successful data carries explicit AWC source, retrieval time, observation source time, API model
version, worldwide jurisdiction, real origin, and source-verified status. Product currency uses
the observation time and a one-hour validity limit. A future or stale observation renders
unavailable even when the network request itself succeeded.

A failed refresh does not erase the prior decoded observation. Its original retrieval and
currency metadata remain visible while the new failure is reported, so update failure cannot be
mistaken for successful replacement.

## UX and safety

The live card says `SUPPLEMENTAL WEATHER ONLY`, states the no-cache and one-request-per-minute
limits, and does not call the result a briefing. Decoded output displays source and retrieval
UTC alongside observation UTC. Manual pasted reports remain unverified and currency-unknown.

## Verification boundary

Unit tests use an injected fetcher and clock to cover success, throttling, no data, provider
throttling, timeout, clock reversal, station mismatch, invalid identifiers, and multiple-report
bodies. A direct HTTPS smoke request to the documented endpoint returned a current raw report on
2026-07-14. Native network loss, captive portals, TLS interception, app lifecycle,
physical-device rendering, provider schema changes, and briefing completeness remain release
blockers.
