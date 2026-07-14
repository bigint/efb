# Privacy model

## Scope and default posture

Driftline can expose a person's precise movements, routines, aircraft, travel plans, documents,
and logbook. The privacy default is therefore **local-first, purpose-limited, and
user-controlled**. Core downloaded-data, planning, document, and simulator workflows must work
without an account. This is a product policy and engineering baseline, not a claim of compliance
in every jurisdiction; counsel must map it to the launch regions and operator context.

## Principles

- Ask for data and permission in context, only when a selected feature needs it.
- Prefer on-device calculation and storage; do not send live location merely to render a map or
  calculate a route.
- No sale of personal data, third-party advertising profile, or precise-location analytics.
- Separate necessary service operations from optional diagnostics and product analytics.
  Optional collection is off until the person chooses it.
- Use source timestamps and provenance without adding persistent user identity.
- Make export, deletion, sync, telemetry, and background-location state visible in the product
  rather than hiding them in a policy.
- A consent screen does not excuse unnecessary collection; remove the data flow when its purpose
  can be met locally.

## Data inventory and lifecycle

Retention values are proposed maxima and require product/legal approval.

| Data category                                         | Purpose and default location              | Collection/share rule                                                                           | Proposed retention/deletion                                      |
| ----------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Live precise location, altitude, track, heading       | on-device situational display/calculation | read only during user-visible navigation; background access separately enabled; never analytics | memory/short rolling state only; no history by default           |
| Saved routes, favourites, aircraft, loading scenarios | on-device planning                        | optional end-to-end or service-protected account sync only after explicit enablement            | until user deletes; tombstones bounded for sync propagation      |
| Logbook and imported documents                        | on-device user record/library             | never telemetry; cloud backup/sync is separate and explicit                                     | until user deletes; backups expire on documented schedule        |
| Account identifiers                                   | authentication and sync                   | API/identity provider only                                                                      | account life plus minimum security/legal retention               |
| Access/refresh tokens                                 | authentication                            | OS secure storage; token only to intended API/identity provider                                 | access token minutes; refresh until expiry/revocation/logout     |
| Dataset/download metadata                             | offline content integrity and support     | generally non-personal; account-free downloads preferred                                        | current and previous verification receipts while installed       |
| Crash diagnostics                                     | stability                                 | opt-in where law/product permits; scrub location, route, tokens, documents                      | proposed 30 days, aggregate longer only if non-identifying       |
| Product analytics                                     | improve workflows                         | opt-in; coarse events only, no persistent cross-app advertising ID                              | proposed 90 days raw, aggregate thereafter                       |
| Security/audit events                                 | abuse response                            | server allowlist; no payloads or precise coordinates                                            | proposed 90 days; longer only for documented incident/legal need |
| Support bundle                                        | user-requested diagnosis                  | preview and explicit share; one case purpose                                                    | delete after case closure plus proposed 30 days                  |
| Export/deletion request record                        | demonstrate request handling              | minimal identity, scope, timestamps, result                                                     | jurisdictionally approved audit period, not exported content     |

Android Auto Backup is disabled in the application manifest so local routes, logbook data, and
imported documents are not silently copied by that platform facility. iOS per-file backup
exclusion and restore inspection still require native implementation and device evidence; the
product must not claim that the explicit-cloud-backup policy is fully enforced on iOS yet.

The production data map must name controller/processor, system, region, subprocessor, legal
basis, recipients, retention, deletion mechanism, and owner for every row before collection
begins.

## Location privacy

### Permission sequence

1. The app starts and supports planning/simulation without location permission.
2. Selecting own-ship or real navigation displays a concise purpose statement, expected
   precision, foreground behaviour, and a `Not now` path.
3. Request iOS **When In Use** or Android foreground location. Approximate permission remains
   usable for non-navigation context but must be labelled insufficient for features whose
   accuracy threshold is not met.
4. Request precise location only at the feature boundary and explain why.
5. Request background/Always access only after a user enables a named feature that genuinely
   continues while backgrounded. It is a separate escalation, never bundled with the foreground
   request.
6. Show persistent in-app state while location capture is active and provide a one-action stop.
   Handle downgrade/revocation immediately.

No SDK receives location by transitive permission unless it is inventoried and approved.
Background location cannot be justified solely by analytics, convenience, or keeping an inactive
map warm. The app must tolerate denied, approximate, one-time, foreground-only, and revoked
permission without coercive loops or fabricated own-ship state.

### Processing and disclosure

- Keep raw sensor/location samples in volatile memory unless the user explicitly starts a
  recording feature whose purpose, interval, retention, export, and deletion are shown first.
- Use monotonic time and accuracy metadata locally; do not encode coordinates in filenames,
  logs, crash keys, notification text, screenshot metadata, or analytics dimensions.
- Weather and dataset requests use user-selected region/route bounding areas where possible. If
  precise coordinates are technically required, disclose the endpoint and retention and avoid
  attaching account identifiers where not needed.
- Network tests must prove that backgrounding, permission denial, simulation, and idle map use
  do not transmit location.

## Telemetry and third parties

Every SDK is a new data recipient and supply-chain principal. Before adoption, record its exact
events/fields, automatic collection, device identifiers, location access, destinations,
subprocessors, retention, deletion API, consent mode, offline buffering, and kill switch. Reject
an SDK that cannot operate without unintended collection or whose payload cannot be
independently inspected.

Diagnostics and analytics controls are separate. Consent/version state is local and server-side
where needed. Turning a control off stops future capture, purges queued events, and offers
deletion of previously linked optional data. Do not use dark patterns, preselected toggles, or
degrade paid/core offline features because optional telemetry is declined.

## Export workflow

Export is available both locally and, when an account exists, through an authenticated API. It
requires recent authentication for cloud data and shows scope, destination, size, and
sensitivity before creation.

- Produce a documented, machine-readable archive (versioned JSON/CSV plus original user
  documents where permitted) with UTC instants, IANA timezone IDs, explicit units, schema
  version, and checksums.
- Include account/profile, saved flights/routes, aircraft/loading scenarios, favourites,
  logbook, annotations, consent settings, and sync metadata.
- Exclude server secrets, other people's data, internal risk signals, and licensed third-party
  data whose redistribution is prohibited; include a clear omission manifest and references
  instead.
- Generate in an isolated job, encrypt at rest, provide a short-lived single-use download,
  rate-limit attempts, audit access, and delete the artifact promptly.
- Local-only export stays on device until the user selects an OS share target; warn that
  destination privacy is then outside Driftline's control.

## Deletion workflow

The product distinguishes `Delete local data`, `Disconnect and remove this device`, and
`Delete account and cloud data` so consequences are understandable. Account deletion requires
recent authentication, explicit scope confirmation, and a recovery window only if clearly
disclosed.

The deletion orchestrator inventories primary database rows, object storage, search/spatial
indexes, analytics identifiers, diagnostic events where linked, queued jobs, support
attachments, push tokens, identity-provider account, exports, and other devices. It propagates
tombstones to offline devices, then removes the tombstone after all supported clients have
acknowledged it or a documented maximum expires. Backups are not silently claimed to erase
instantly; they age out on a declared schedule and deleted data is not restored to active
systems.

The user receives a result with request ID, time, completed categories, temporary/legal
exceptions, and expected final expiry. Failed components retry idempotently and surface to
operations. Logout alone is not account deletion; uninstall alone is not cloud deletion. Revoked
tokens and secure-store entries are removed even when a deletion job partially fails.

## Privacy UX and transparency requirements

- Privacy dashboard: permission state, active/background location, sync scope, telemetry
  choices, stored regions, storage size, export, and deletion.
- App/store privacy disclosures must be generated from the verified production data map and
  network capture, not copied from a template.
- iOS privacy manifests/reason APIs and Android Data safety declarations are reviewed against
  direct code and included SDK manifests for every release.
- Support and incident notices state what data was affected, not only the name of a service.
- Children/minors, employer/operator-managed devices, and multi-crew sharing are unresolved
  launch-scope decisions and require specific legal/product models.

## Privacy verification gates

- Permission tests on clean install, denial, approximate, one-time, foreground-only, background,
  revoke-in-settings, and OS upgrade.
- Packet capture in each state, with seeded coordinates and identifiers, proving the
  destination/field allowlist and absence from third-party telemetry.
- Search app container, backup, logs, crash reports, clipboard, notifications, screenshots, and
  support bundle for seeded secrets and coordinates.
- Complete export reconciliation against the data inventory, then import/read the
  machine-readable form without undocumented unit/time assumptions.
- Complete deletion reconciliation on server, object store, indexes, telemetry, exports, backup
  schedule, and a second offline device reconnecting later.
- SDK inventory diff and privacy declaration review block release on unexplained new data flows.

## Primary references

- [Apple: Requesting authorization to use location services](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services)
- [Android: Request location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions)
- [Android: Access location in the background](https://developer.android.com/develop/sensors-and-location/location/background)
- [Apple: Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Google Play: Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [EU Regulation 2016/679, Articles 15, 17 and 20](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
