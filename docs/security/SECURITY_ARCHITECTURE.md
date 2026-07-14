# Security architecture

## Purpose and assurance boundary

This document turns the Phase 0 threat model into implementation constraints.
It describes the required target architecture; no control is considered present
until release evidence demonstrates it in the selected native build and backend.

The design assumes React Native with Expo development builds. React Native is
not a browser security boundary: native storage, OS permissions, deep links,
native modules, Metro/OTA bundles, and platform networking need native-specific
verification. Browser-only advice such as `HttpOnly` cookies, CSP, SRI, or DOM
sanitisation applies only to future web surfaces.

## Security invariants

- Nothing shipped in JavaScript, native resources, app configuration,
  `EXPO_PUBLIC_*`, or an over-the-air update is secret.
- All external and persisted data is untrusted until structurally and
  semantically validated at the boundary where it enters a trusted model.
- No invalid input, missing field, failed verification, or stale source may
  silently fall back to an operationally plausible value.
- Authentication is not authorization. The API enforces subject, action, and
  resource ownership for every object access.
- The active dataset changes only through a verified, atomic transaction and is
  never activated during a real or simulated navigation session.
- Security state is explicit: unknown, unavailable, stale, corrupt, simulated,
  and revoked are model values, not log-only conditions.

## Mobile storage policy

| Class | Examples | Storage rule | Backup/sync rule |
|---|---|---|---|
| S0 public | airport fixtures, public styles | verified SQLite/files; checksum still required | may be backed up if licence allows |
| S1 private preferences | units, theme, dismissed education | MMKV acceptable; validate reads and version schema | platform backup allowed unless it reveals sensitive usage |
| S2 user operational data | routes, favourites, aircraft, annotations, logbook | SQLite with OS file protection; application encryption assessed per data and platform threat; transactional writes | explicit sync setting; export/deletion inventory |
| S3 secrets | refresh token, device private key, wrapped database key | asynchronous OS-backed secure storage only | device-only/non-migrating where practical; never general backup |
| S4 root/release secrets | dataset root private keys, app-store signing credentials, provider secrets | never on user device or in repository; managed signing service/HSM or offline custody | independently controlled backup and recovery |

On iOS, S3 uses Keychain with an accessibility class chosen per lifecycle need;
default to accessible only while unlocked and this device only. Use passcode or
user-presence constraints only when recovery and background behaviour are
defined. On Android, generate non-exportable keys in Android Keystore and use
them to protect small credentials or wrapping keys. Hardware backing is queried
and recorded as capability, not assumed on every device.

`expo-secure-store` is an acceptable adapter only after native configuration,
backup exclusion, key invalidation, biometric-change, uninstall/reinstall, and
large-value error behaviours are tested. Use asynchronous calls so
authentication does not block the JavaScript thread. MMKV and SQLite are not
secret stores. Sensitive plaintext must not enter Redux/Zustand persistence,
logs, clipboard, notifications, screenshots, crash breadcrumbs, or analytics.

## Authentication and API boundary

### Mobile-to-API contract

- Use HTTPS with platform hostname and certificate validation. Never add a
  development trust bypass to a production build.
- Use Authorization headers with short-lived, audience- and issuer-bound access
  tokens. Refresh credentials remain in S3 storage and rotate on use.
- Native OAuth, if selected, uses system browser/ASWebAuthenticationSession or
  Custom Tabs, Authorization Code with PKCE, exact redirect URIs, and `state` /
  nonce verification. Embedded WebView login is prohibited.
- API base URLs are build-time public allowlisted configuration. User input,
  deep links, synced settings, or a dataset cannot change credentialed request
  origins.
- Request identifiers are opaque random values; never use sequential public IDs
  as authorization boundaries.

### Server validation sequence

1. Terminate TLS and enforce request-body, header, timeout, and decompression
   limits before parsing.
2. Authenticate token signature, algorithm allowlist, issuer, audience, expiry,
   not-before, subject, and revocation/session state.
3. Select the exact versioned route and content type.
4. Validate path, query, headers, and body with strict Zod schemas that reject
   unknown fields where forward compatibility is not intended.
5. Authorize the subject against the action and object loaded server-side.
6. Apply domain invariants, typed units, geographic bounds, and idempotency.
7. Commit transactionally; return a versioned response validated at the mobile
   adapter again.
8. Emit a redacted security audit event without precise location, token, or
   imported content.

Errors use stable public codes and correlation IDs, not stack traces or raw
upstream payloads. Rate limits are subject/action aware. Export and deletion
require recent authentication and resist identifier enumeration. Cloud sync
uses per-record versions and explicit conflict state; server timestamps never
rewrite operational source time.

## Network trust and certificate pinning assessment

The baseline uses current OS trust stores, hostname validation, modern TLS, and
signed aviation datasets. Certificate pinning is deferred because a native app
cannot be repaired quickly if pins, intermediates, or endpoints rotate while a
pilot is offline. It may be proposed only with:

- a documented attacker capability not already covered by platform TLS and
  signed content;
- pin scope and at least one independently controlled recovery path;
- expiry and rotation rehearsal before the old key disappears;
- safe behaviour for captive portals, wrong device time, enterprise roots, and
  offline use;
- remote observability that sends no route or precise-location data; and
- no hidden switch that disables certificate validation.

## Aviation dataset trust architecture

### Trust roles and key custody

Adopt the separation concepts of The Update Framework (TUF), whether through a
compatible implementation or an equivalently reviewed protocol:

- **root:** long-lived trust anchors and role thresholds; held offline with
  independently controlled recovery copies;
- **targets:** authorizes manifest/target content and delegated jurisdictions;
- **snapshot:** binds a consistent set of metadata versions;
- **timestamp:** short-lived freshness statement available online.

Production root and targets keys must not be general CI environment secrets.
Root rotation requires old-root and new-root verification, monotonically
increasing version, threshold signatures, an emergency playbook, and a client
compatibility window.

### Canonical manifest and target policy

The client ships a trusted root, not a remotely supplied first root. Signed
metadata uses an unambiguous canonical representation (for example TUF's
specified canonical JSON rules or RFC 8785 if the protocol explicitly chooses
it). A manifest contains at minimum:

```text
schemaVersion, manifestVersion, datasetId, jurisdiction, generatedAt,
effectiveFrom, expiresAt, source identifiers and source revisions,
minimumAppVersion, targets[{path, byteLength, sha256, mediaType,
uncompressedByteLength}], signer key IDs, signatures
```

Verification order is fixed and independently tested:

1. Parse within hard byte/depth/count limits; reject duplicates and unknown
   critical fields.
2. Verify threshold signatures against the locally trusted, non-expired role.
3. Reject metadata version rollback, expired metadata, inconsistent snapshot
   references, unsupported schema, wrong jurisdiction, or incompatible app.
4. Download to a random staging location with resumable-range validation and
   strict compressed/uncompressed size limits.
5. Verify exact byte length and SHA-256 for every target before parsing.
6. Validate SQLite integrity, schema/migrations, referential and semantic
   constraints, geographic bounds, typed units, and source/effective dates.
7. Persist a verification receipt containing manifest digest and signer IDs.
8. Atomically switch one active pointer in a transaction; retain the previous
   known-good set until post-activation health checks pass.

A checksum detects corruption but does not authenticate a malicious publisher;
the signature authenticates metadata that binds checksums to a trusted release.
HTTPS is transport protection, not a substitute for either. Partial packs,
individual files from different manifests, expired metadata, and unsigned
emergency feeds never activate. Revocation or expiry leaves an explicit blocked
or stale state; it does not silently downgrade to unverified content.

## Local integrity, lifecycle, and recovery

- Separate source, normalised, cached, user, and derived stores or namespaces.
- SQLite migrations are forward-only, versioned, transactional, and tested from
  every supported version. User data backup is created before destructive
  migration and is never conflated with downloadable datasets.
- Files use create-write-fsync-rename semantics where platform APIs support it;
  a journal records staging, verified, activating, active, and rollback states.
- On process restart, reconcile the journal before exposing data. Ambiguity
  selects the last verified active set and reports recovery.
- Use monotonic elapsed time for freshness intervals; wall-clock time and IANA
  timezone data are retained for display/source semantics. Clock rollback never
  makes stale data fresh.
- Clipboard export, OS share sheets, screenshots, and notification previews are
  explicit disclosure boundaries and require product/privacy decisions.

## Logging, telemetry, and incident response

Security logs use an allowlist: event type, coarse component, app/build/dataset
version, result code, and random correlation ID. They exclude tokens, headers,
request bodies, document text, names, registration numbers, exact coordinates,
routes, and sensor samples. Debug logging is compile-time gated out of release
builds. Support bundles are previewable and user-initiated.

The operational plan must support token/session revocation, dataset key
revocation, compromised release withdrawal, safe app rollback where platform
rules permit, user notification, evidence preservation, and post-incident key
rotation. A server-side kill switch may disable an online feature but must not
erase offline data or falsely present a disabled source as healthy.

## Software supply chain

- Commit `pnpm-lock.yaml`; CI uses the exact pnpm version and
  `pnpm install --frozen-lockfile` from a clean workspace.
- Review all direct dependencies, native modules, licences, maintainers,
  transitive footprint, install scripts, and update cadence. New native or
  parsing code receives explicit security ownership.
- Dependabot/Renovate proposals never auto-merge into release branches; known
  vulnerabilities are triaged for reachability and operational risk.
- Pin third-party CI actions to immutable commit SHAs and minimise job
  permissions. Prefer OIDC short-lived credentials over stored cloud keys.
- Build release artifacts in isolated ephemeral workers; produce SBOM, hashes,
  signed provenance/attestation, and retain toolchain versions.
- Verify attestations and app/dataset signatures in a separate release job.
  Provenance establishes origin, not that an artifact is safe.
- OTA updates, if enabled, receive the same review, environment separation,
  rollback, signing, and evidence as store binaries; an update cannot relax the
  minimum native runtime or security policy.

## Required security tests before implementation gates close

- Static secret and release-bundle scan, dependency/license audit, lockfile
  drift rejection, CI permission review, and attestation verification.
- Two-account authorization matrix for every API resource and mutation.
- Token rotation, replay, expiry, revocation, biometric invalidation, backup,
  reinstall, logout, and remote-device removal.
- Malformed/deep/large payload, unknown field, numeric overflow/NaN, path and
  URL allowlist, decompression bomb, and parser timeout tests.
- Dataset invalid signature, wrong key/role/threshold, hash/length mismatch,
  rollback, freeze, mix-and-match, interrupted activation, and corrupt database.
- Network capture proving no secret or precise location enters unintended
  endpoints, analytics, crash reporting, or support bundles.

## Primary references

- [Apple Keychain Services](https://developer.apple.com/documentation/security/keychain-services)
- [Apple: Restricting keychain item accessibility](https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility)
- [Android Keystore system](https://developer.android.com/privacy-and-security/keystore)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [OAuth 2.0 for Native Apps, RFC 8252](https://www.rfc-editor.org/rfc/rfc8252)
- [OAuth 2.0 Security Best Current Practice, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700)
- [The Update Framework specification](https://theupdateframework.github.io/specification/draft/)
- [JSON Canonicalization Scheme, RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)
- [NIST SP 800-218, Secure Software Development Framework 1.1](https://doi.org/10.6028/NIST.SP.800-218)
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
