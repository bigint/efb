# Implementation security review

Review date: 2026-07-14  
Candidate: `e96a2e2` plus this report  
Scope: React Native mobile slice, workspace/CI configuration, direct and transitive dependencies

## Executive summary

No critical or high-severity implementation vulnerability was found in the current demonstration
slice. The app has no account, API client, telemetry, remote content renderer, or production
dataset updater yet, so several major trust boundaries exist only in design documents and cannot
be credited as implemented controls.

The review found two medium-priority hardening gaps and one low-priority upstream advisory:
GitHub Actions are version-tagged rather than commit-pinned, route intent is persisted in
unencrypted MMKV despite its future privacy sensitivity, and Expo's build tooling brings a
moderately rated `uuid` advisory through `xcode`. None currently provides a demonstrated runtime
exploit path in the shipped mobile JavaScript bundle, but all require disposition before a
release candidate.

## Critical findings

None found.

## High findings

None found.

## Medium findings

### SEC-001 — CI actions are not pinned to immutable commits

- **Remediation status (2026-07-14):** Resolved after this review. All three actions are pinned
  to full commit SHAs with their major release tags retained in comments.

- **Rule:** supply-chain reproducibility
- **Severity:** Medium
- **Location:** `.github/workflows/ci.yml:16-21`
- **Evidence:** `actions/checkout@v4`, `pnpm/action-setup@v4`, and `actions/setup-node@v4`
  resolve mutable major-version tags.
- **Impact:** a compromised or moved action tag could execute attacker-controlled code in CI,
  alter verification, or access the repository token within its read-only permission scope.
- **Fix:** pin each action to a reviewed full commit SHA while retaining the release tag in a
  comment; automate reviewed update pull requests.
- **Mitigation:** the workflow already sets top-level `contents: read`, has no secrets or
  release permissions, and performs a frozen-lock install.
- **False-positive notes:** GitHub-maintained actions reduce likelihood but do not make a tag
  immutable. Organization-level action allowlists were not visible in this repository.

### SEC-002 — Route intent is persisted in MMKV without a privacy boundary

- **Rule:** sensitive local-data minimisation
- **Severity:** Medium before real user routes are enabled; Low in the current fictional demo
- **Location:** `apps/mobile/src/store/flight-store.ts:25-30,59-68`
- **Evidence:** the persisted Zustand projection writes `routeIdentifiers` and `selectedAirport`
  to the default unencrypted MMKV instance.
- **Impact:** future real route/favourite identifiers can reveal travel patterns through a
  device backup or local compromise and would conflict with the architecture's rule that durable
  user records live in SQLite.
- **Fix:** keep MMKV limited to reconstructible presentation preferences. Move real route
  records and active-plan recovery snapshots to the user SQLite database with an explicit
  backup/data-protection policy. Store credentials only in OS-protected key storage.
- **Mitigation:** current values refer only to three fictional demonstration airports; no
  location history, account token, or live position is persisted.
- **False-positive notes:** encryption at rest cannot protect an unlocked compromised device;
  the primary control is data minimisation and correct storage ownership.

## Low findings

### SEC-003 — Moderate upstream `uuid` advisory exists in Expo build tooling

- **Rule:** dependency and supply-chain hygiene
- **Severity:** Low for this candidate's runtime; registry rating is Moderate
- **Location:** `pnpm-lock.yaml:5700,9812,9914`
- **Evidence:** `pnpm audit --json` reports GHSA-w5hq-g745-h8pq for `uuid@7.0.3`, reached
  through Expo config plugins' `xcode` package. The vulnerable operation concerns caller-
  provided output buffers in UUID v3/v5/v6.
- **Impact:** no call path from untrusted mobile input was found; exposure is in local/CI native
  project generation. A future malicious build input or upstream usage could change that
  assessment.
- **Fix:** adopt the patched transitive version when Expo's tested dependency graph supports it.
  Do not force a cross-major override without native prebuild and build regression tests.
- **Mitigation:** keep native config inputs reviewed, run builds on isolated ephemeral workers,
  and monitor the Expo/xcode dependency update.
- **False-positive notes:** `pnpm audit --audit-level high` passes. The advisory remains real;
  only its reachable impact is currently low.

## Controls observed

- Strict TypeScript and Zod validation exist at the current external airport adapter boundary.
- No `dangerouslySetInnerHTML`, DOM injection sink, dynamic code execution, `postMessage`, web
  token storage, arbitrary outbound request, or embedded client secret was found under `apps/`
  or `packages/`.
- The client currently makes no network request and renders no user-provided active content.
- pnpm uses a frozen lockfile in CI and explicitly allowlists only Skia's reviewed native
  postinstall script.
- The location permission copy states supplemental awareness and requests foreground location;
  no background-location permission is currently declared.

## Verification performed

- High-signal source scan for React/DOM injection sinks, dynamic execution, storage/token
  patterns, client environment secrets, arbitrary URLs, and network clients
- Seed-pattern secret scan over tracked source, excluding the lockfile
- `pnpm audit --audit-level high` — passed
- `pnpm audit --json` — one Moderate advisory recorded above
- `pnpm verify` — passed before this report
- Expo Doctor — 20/20 checks passed before this report

## Required follow-up

This report does not approve the future API, authentication, dataset update, document import,
weather, telemetry, or account deletion/export paths. Each introduces new trust boundaries and
requires implementation review plus the negative tests defined in the threat model and test
strategy.
