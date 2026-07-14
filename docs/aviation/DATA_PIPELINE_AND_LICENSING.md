# Data pipeline and licensing controls

Status: Phase 0 architecture and governance plan Safety objective: no data reaches a production
package without proven source, rights, validity, integrity, and coverage

## 1. Architecture decision

Build independent source adapters feeding a provenance-preserving canonical store. Do not create
one opaque “aviation database” assembled from mixed sources. Static data, charts, terrain,
obstacles, weather, NOTAM, magnetic models, solar derivations, and user data have different
licences, update semantics, assurance needs, and failure modes.

```text
provider discovery -> legal/source registry -> acquisition quarantine
 -> immutable raw artifact -> source-schema validation -> normalized staging
 -> reconciliation/provenance -> domain QA -> cycle release candidate
 -> signed manifests/packages/APIs -> device verification and activation
 -> monitoring, correction, rollback, expiry, and deletion
```

No stage may erase the ability to answer: who supplied this field, under which terms, from which
edition, when was it effective/retrieved, how was it transformed, and what checks passed?

## 2. Source and licence registry

Every source has a reviewed registry record before credentials or scheduled ingestion are added:

- legal provider and authority/originator;
- product/dataset name, data categories, jurisdiction, coverage, and intended product functions;
- access method, authentication, endpoint/contact, rate limits, and SLA;
- current contract/terms/licence files stored immutably with digest, effective date, reviewer,
  and renewal/termination dates;
- permissions for access, copy, transform, combine, commercial use, cache, offline distribution,
  end-user redistribution, derived products, and archives;
- attribution, source-mark, disclaimer, click-through, reporting, royalty, audit,
  export-control, and deletion duties;
- third-party elements/exclusions;
- technical cadence, preview/production editions, correction mechanisms, and retention
  requirements;
- quality/integrity representations and permitted intended uses;
- approved fallbacks and prohibited combinations; and
- status: `research`, `legal-review`, `approved-internal`, `approved-production`, `suspended`,
  `terminated`, or `revoked`.

Default-deny: an unspecified permission is false. `Free`, `open website`, `public sector`, or
`official` never auto-populates a right.

## 3. Data classes and isolation

| Class                              | Storage/release rule                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Authoritative licensed static data | Separate raw and normalized namespaces by provider/edition; combine only under contract-compatible rules.                   |
| Public-domain government data      | Preserve notices, source records and hashes; verify the specific product and third-party exclusions.                        |
| ODbL/community data                | Physically/logically isolate source and derived database; attribution and share-alike review before distribution.           |
| Contract-confidential data         | Provider-specific access controls, encryption keys, logs, retention, and employee need-to-know.                             |
| Charts/raster products             | Separate object packages and licence manifests from extracted metadata; no vectorization unless granted.                    |
| Dynamic weather/NOTAM              | Short-lived operational cache, raw-message retention per terms, continuous coverage monitoring; not packed as static AIRAC. |
| Terrain/obstacles                  | Editioned tiles/files with datum, acquisition age, resolution, void/verification policy and area manifest.                  |
| Derived models/results             | Reference all inputs, algorithm/model version and licences; do not launder upstream restrictions through derivation.        |
| User-entered aircraft/routes       | Tenant/private encryption and privacy retention controls; never used to “correct” official source silently.                 |

Open and proprietary data can coexist in the product without being combined into one derivative
database. Attribution UI, downloads, APIs, and device storage must preserve that separation.

## 4. Acquisition quarantine

Only provider-approved mechanisms are allowed: documented bulk download, API, subscription
delivery, or contracted transfer. Scraping requires explicit written permission and an
engineering review; robots access does not grant data rights.

On arrival, before parsing:

1. record URL/message ID, HTTP/provider metadata, retrieval time from a trusted server clock,
   credentials identity, and expected edition;
2. stream to immutable object storage, malware-scan where relevant, calculate SHA-256, and
   preserve original filename/content type;
3. verify provider checksum/signature/CRC if supplied;
4. link the exact active licence snapshot;
5. reject unexpected geography, edition, size, media type, encryption, or schema version;
6. prohibit release from quarantine until access and integrity checks pass; and
7. record failed/partial retrievals rather than overwriting the last success.

Secrets are held in managed secrets storage, scoped per adapter/environment, rotated, and
excluded from logs/packages. Provider production access is never used in developer mobile
clients.

## 5. Source adapters

Each adapter owns download, raw schema, parsing, source semantics, and source-specific tests. It
produces normalized staging records plus lossless extensions and never writes the canonical
store directly.

An adapter declares:

- supported source editions/schema versions and a fail-closed unknown-version path;
- expected cadence, release calendar, preview semantics, and lateness threshold;
- authoritative identifiers, units, datum, coordinate precision, nil/unknown codes, and
  character encoding;
- source status/cancellation/replacement rules;
- mapping version and per-field provenance;
- invariants, referential checks, and acceptable deltas;
- source alerts/notices monitored; and
- licence-controlled fields or artifacts that must not flow to some products.

Parser warnings are data. Unknown enumerations are preserved and block unsafe downstream use
rather than becoming `other` without review.

## 6. Canonical and temporal storage

Use bitemporal storage:

- **valid time**: when the fact applies operationally;
- **record time**: when the platform acquired/accepted it.

Static AIRAC releases keep at least previous, current, and next editions so clients can prepare
downloads and switch exactly at the effective instant. Non-AIRAC corrections and urgent notices
layer over the base edition with their own source/effective intervals. A new cycle never mutates
the prior cycle in place.

Every canonical field links to source record and mapping transform. Reconciliation produces an
explicit assertion:

- selected value and precedence rule;
- alternate/conflicting values;
- equivalence confidence and any manual decision;
- reviewer/reason/time; and
- affected downstream packages/calculations.

Precedence is function-specific. A State AIS value can outrank a community value for runway
length, while a community surface shape may be displayed as non-authoritative context because no
official vector geometry is licensed. The system never labels the resulting mixed view simply
“official.”

## 7. Static release pipeline

### 7.1 Validation gates

1. **Schema:** types, required fields, enumerations, encoding, units, CRS/datum and source
   version.
2. **Referential:** runway-to-airport, route-to-fix/navaid, airspace component,
   chart-to-airport/procedure, supersession and identifier links.
3. **Geometry:** coordinate ranges, invalid rings, antimeridian/pole handling,
   self-intersections, arc interpretation and implausible jumps.
4. **Temporal:** edition/effective ordering, overlaps/gaps, cancellation, preview and expiry
   semantics.
5. **Domain:** runway designator/heading plausibility, positive declared distances, vertical
   ordering, frequency/channel domains, duplicate identifier context, and known source
   exceptions.
6. **Delta:** counts and geographic/category changes compared with previous/current/preview;
   thresholds trigger human review, never automatic rejection of legitimate mass change alone.
7. **Cross-product:** chart metadata/static data edition agreement and high-risk conflict
   reports.
8. **Licence:** every output field/artifact and intended channel covered by an active grant.
9. **Acceptance:** aviation reviewer approves exceptions and release notes; engineering signs
   integrity; legal automation confirms terms dates.

### 7.2 Packaging

Packages are deterministic and content-addressed. A signed manifest contains:

- product/jurisdiction/coverage and schema version;
- source datasets and licence-attribution IDs;
- edition/cycle and effective/expiry intervals;
- file names, sizes, hashes, compression and encryption/key ID where applicable;
- quality/coverage limitations and excluded layers;
- required app/schema version;
- urgent corrections incorporated; and
- release ID/signature.

Generate small regional/corridor packages where contracts allow. Device storage must not mingle
databases whose redistribution terms conflict. Attribution and legal notices travel offline with
the package.

### 7.3 Device activation

The client downloads to staging, verifies signature/hash/size/schema/free space, performs a
quick integrity query, and activates atomically. An interruption never corrupts the active
package. Keep a known-good rollback subject to licence retention. Activation uses trusted
effective time and explicit cycle logic; it cannot be triggered solely by a user-changed device
clock.

The UI derives currency from the active signed manifest and runtime deltas. A green/current
state is impossible when the manifest, clock trust, correction stream, or required layer is
unknown.

## 8. Dynamic pipeline

### 8.1 Weather

- Acquire server-side according to provider cadence/rate limits; cache raw responses and
  conditional-request metadata.
- Record observation, issue, valid, correction/amendment, retrieval, parse, publish and expiry
  times separately.
- Preserve raw TAC/IWXXM/BUFR or provider payload as permitted; decoded products name parser
  version and warnings.
- Monitor station/product expected-update windows, geographic coverage, delayed upstream
  products, partial responses, and frame gaps.
- Do not mix third-party lightning/radar content into public-domain NOAA output without
  source-level rights.
- Publish a product status record even when data is absent, so clients distinguish
  `no phenomenon reported`, `no report`, `outside coverage`, and `pipeline failure`.

### 8.2 NOTAM

- Use only an operational/contracted feed with documented scope, not an undocumented/demo
  endpoint.
- Store immutable original message and structured parse; model issue, validity, schedules,
  estimated end, replacement, cancellation, Q-line and source office.
- Deduplicate by source identity/version, not normalized text alone.
- Re-evaluate route relevance when route/time/altitude or parser changes, while retaining all
  applicable/unparsed source records for review.
- Monitor sequence gaps, office/geography coverage, unexpected volume drops/spikes, late
  cancellations and stale active messages.
- A briefing manifest records query, response coverage, retrieval time, provider acknowledgement
  and failures; it does not claim “official briefing” without contractual/regulatory basis.

Dynamic cache retention and user-device expiry follow both operational need and contract. Stale
dynamic data loses live styling even if retained for audit.

## 9. Terrain, obstacles, magnetic and solar data

- Terrain tiles include DEM/DSM type, horizontal/vertical datum, geoid, resolution,
  acquisition/edition date, void/fill mask and source licence. Reprojection/resampling creates a
  derived artifact with method/version, never overwrites raw data.
- Obstacle records preserve source status and source values unchanged where required (FAA DOF
  explicitly says its public-domain data may not be changed:
  [FAA FAQ](https://www.faa.gov/air_traffic/flight_info/aeronav/obst_data/doffaqs/)). Spatial
  indexes and display projections point back to the unchanged record.
- WMM coefficients are a small independently signed model package with epoch/expiry and NOAA
  test vectors. Prevent magnetic output after model expiry until a reviewed model activates
  ([NOAA WMM](https://www.ncei.noaa.gov/products/world-magnetic-model)).
- Sunrise/sunset is locally derived from a versioned algorithm; store position/date/event
  definition/refraction assumptions and polar state. Do not scrape USNO tables as the runtime
  dataset.

## 10. Corrections, revocation and incident response

Sources can publish urgent safety alerts outside the next regular cycle. Maintain an on-call
ingestion path:

1. authenticate notice against provider channel;
2. identify impacted records, packages, calculations, users and saved briefings/routes;
3. classify as metadata notice, delta/overlay, package replacement, feature disablement, or full
   revocation;
4. produce reviewed signed correction with expiry/supersession;
5. notify clients and prevent known-bad package reactivation;
6. verify rollout and coverage; and
7. retain an audit timeline and post-incident action.

Licence termination can require the same machinery. The registry emits a kill date/action; build
systems stop new output, APIs revoke access, device packages expire/delete as required,
attribution remains where required, and replacement data does not silently inherit the old
source's identity.

## 11. Observability and service objectives

Dashboards and alerts cover:

- source release expected/seen/late, acquisition duration and failures;
- current/next edition, effective countdown, unprocessed provider notices;
- schema/enum drift, record/field counts, geographic gaps and delta outliers;
- raw/normalized/package checksums and signature failures;
- weather/NOTAM latency, sequence/coverage, station/product gaps and cache age;
- package download/verification/activation/rollback success by app version and region;
- licence/contract review, renewal, royalty/reporting and deletion deadlines;
- attribution rendering tests; and
- user-visible unavailable/stale states, without collecting unnecessary flight/location data.

Set source-specific SLOs only after measuring provider behaviour and contract commitments. An
internal 99.9% pipeline SLO cannot create upstream authority or completeness.

## 12. Access, audit and change control

- Least privilege for provider credentials, raw data, contract-confidential products, manual
  overrides and signing keys.
- Separate development, staging and production accounts/buckets/keys.
- Two-person approval for production manual reconciliation, package signing, emergency
  correction and licence override.
- Append-only audit log for source, legal, mapping, review and release changes.
- Code review plus schema fixtures for adapter updates; shadow-run new mappings across
  current/next/archives.
- Signing keys in managed hardware-backed service where available; rotation and compromise
  playbook tested.
- No production data copied to personal devices or public test artifacts beyond contract.

## 13. Licensing-specific failure modes

| Failure                                                 | Prevention / response                                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Public URL mistaken for open licence                    | Default-deny registry; legal evidence required before production status.                              |
| Federal data assumed wholly public domain               | Product-level review for third-party content, marks, specific terms and modification restrictions.    |
| Chart image rights assumed to cover extracted vectors   | Separate artifact/metadata/derivative permission flags.                                               |
| ODbL data merged into proprietary canonical DB          | Isolated source/derived DB, counsel-approved architecture, complete attribution/share-alike workflow. |
| CC BY-NC community data shipped commercially            | Block; obtain written commercial licence.                                                             |
| Provider content displayed without required attribution | Attribution registry rendered from active package; snapshot and offline tests.                        |
| Licence expires while package remains on devices        | Signed manifest expiry/kill action, device enforcement and contract-aligned deletion.                 |
| Derived result hides restricted input                   | Transitive lineage/licence calculation on every output.                                               |
| Official source transformed and presented as official   | Source/derived labels, unchanged raw access where allowed, non-endorsement notices.                   |
| Third-party weather layer treated as NOAA public domain | Field/layer origin registry and distribution gate.                                                    |

## 14. Environments and test data

- Unit tests use synthetic fixtures written for the project and small provider samples only when
  terms allow repository inclusion.
- Contracted production extracts do not enter a public repository.
- Integration tests can download official public samples at test time if rate limits/terms
  permit, but pin hashes and fail clearly when upstream changes.
- Golden data documents source, edition, licence and expected purge date.
- Synthetic NOTAM/weather messages must be visibly impossible to confuse with real operational
  products.
- A local “licence lint” fails builds when a package/file lacks an approved licence,
  attribution, source, effective/expiry time or intended-use grant.

## 15. Phase sequence

### Phase A — rights and raw proof

- Populate source/licence registry for FAA NASR, FAA DOF, AWC, USGS 3DEP, Copernicus DEM and
  WMM.
- Obtain written FAA product-rights clarification before any redistribution.
- Build read-only adapters and immutable raw manifests; no mobile package.
- Send formal data/licensing enquiries to AAI, NATS and EUROCONTROL.

### Phase B — U.S. static release candidate

- Normalize airports/runways/navaids/fixes/airways/airspace and DOF.
- Run current/preview/archive cycle, schema drift, conflict, and urgent-correction exercises.
- Package a small non-redistributed internal region and validate atomic offline activation.

### Phase C — weather and dynamic status

- Add AWC backend cache with raw/decoded timestamps and explicit missing/stale states.
- Contract a production NOTAM feed before implementing NOTAM briefing claims.

### Phase D — terrain/model data

- Validate Copernicus/3DEP datum, voids, sampling and device storage.
- Ship WMM only after official test vectors pass and model expiry is enforced.

### Phase E — additional jurisdictions

- Add a jurisdiction only after regulatory rule-pack review, provider contract,
  attribution/offline rights, representative data QA and failure-state verification.

## 16. Go/no-go checklist for a dataset

A dataset is `approved-production` only when all answers are yes:

- Is the provider/originator authoritative level understood and accurately described?
- Do written terms permit every intended commercial, transform, cache, offline and
  redistribution action?
- Are third-party exclusions and attribution implemented?
- Are coverage, cadence, effective/expiry semantics, schema, datum, units and limitations
  documented?
- Are raw integrity, parser, delta, domain and cross-product tests passing?
- Can urgent correction, rollback, expiry, contract termination and device deletion be executed?
- Does the UI reveal source, currency, coverage and degraded state without implying approval?
- Have aviation, engineering, QA and legal reviewers approved the exact version/use?

If any answer is no or unknown, the production fallback is to omit/disable the function and
direct the user to the current official source—not to substitute a lower-authority dataset
invisibly.
