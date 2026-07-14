# Release evidence specification

## Rule

A phase or release is complete only when reviewers can reproduce its claims
from retained evidence. A green dashboard, screenshot, verbal report, or test
count alone is insufficient. Phase 0 currently has no executable app evidence;
all implementation and performance entries remain `NOT RUN` until generated.

## Evidence packet layout

Each candidate stores an immutable packet outside ephemeral CI and links it from
the release record:

```text
release-evidence/<candidate-id>/
  manifest.json
  scope-and-limitations.md
  build/
  static/
  unit/
  integration/
  e2e/
  offline-and-recovery/
  accessibility/
  performance/
  security-and-privacy/
  safety-review/
  known-risks-and-waivers/
  approvals/
```

`manifest.json` is machine-readable and contains:

- candidate/product/platform version, Git commit and clean/dirty status;
- native runtime, JavaScript/OTA update, dataset manifest digest and active
  jurisdiction/version;
- Xcode, Android Gradle/SDK/NDK, Node, pnpm, Expo, React Native, test tool, and
  tzdb versions;
- build workflow/run ID, artifact SHA-256, SBOM digest, provenance/attestation
  identity and verification result;
- environment and fixture checksums, device model/identifier class, OS version,
  locale, timezone, accessibility settings, network profile;
- each check's command/protocol, start/end, status (`PASS`, `FAIL`, `BLOCKED`,
  `NOT RUN`), raw artifact path, and responsible owner;
- limitations, open defect IDs, waiver IDs, and approval identities/times.

Never convert `BLOCKED` or `NOT RUN` to `PASS`. A rerun appends a new attempt and
preserves the first failure and classification.

## Required evidence by category

| Category | Minimum evidence |
|---|---|
| Source/build | reviewed commit, clean checkout, frozen lock install, build logs, signed artifacts, checksums, SBOM, verified provenance |
| Static | typecheck, lint, formatting, secret scan, dependency/advisory and licence results, forbidden client-secret/bundle scan |
| Unit/property | raw test and coverage output, fixture/seed/shrink records, independent geospatial oracle/version, mutation results for critical packages when adopted |
| Integration | API/schema, SQLite migration, storage, secure token, sensor/native module and permission results by platform |
| End to end | Maestro command/version, JUnit, logs, screenshots/video, first-attempt result, device/OS, fixture reset proof |
| Offline/recovery | network profile, kill-point matrix, corrupt fixtures, before/after database and user-data hashes, active/rollback dataset receipts |
| Accessibility | automated output plus manual VoiceOver/TalkBack protocol, focus/read order, Dynamic Type, contrast, target, gesture alternatives, device/layout matrix |
| Performance | raw traces, signposts, release-build hash, hardware/OS/thermal/power state, dataset/workload, repetitions, median/p95/worst and budget decision |
| Security/privacy | threat-ID traceability, authorization negatives, signature/rollback attacks, token lifecycle, network capture, SDK/privacy declaration diff, export/deletion reconciliation |
| Safety | Red Team hazard review, stale/simulated/GPS-loss evidence, unresolved hazards and operational limitations |

Coverage percentage is supporting information, never a substitute for the
required scenario matrix. Screenshots support human review but values and
states must also have structured assertions.

## Performance evidence protocol

For every claimed budget:

1. Name the user operation and exact start/stop signposts.
2. Name production-like release build and confirm developer/profiling UI state.
3. Name physical device, OS, battery, power attachment, thermal state, free
   storage, network, orientation/split width, dataset and overlay workload.
4. Run declared warm-up and at least the predefined repetition/session length.
5. Retain native trace and machine-readable samples.
6. Report median, p95, worst, variability and failed runs; frame pacing reports
   missed frames/jank and both JS/UI work, not an eyeballed FPS counter.
7. Compare against a versioned baseline on the same device class and document
   any material regression.

Simulator measurements may locate regressions but cannot satisfy physical-device
launch, frame pacing, memory, thermal, battery, sensor, or background-location
gates.

## Manual evidence protocols

Manual tests use a script with preconditions, numbered actions, expected visible
and spoken output, actual result, device/build/data identity, assessor, time,
and attachments. Required manual areas include sunlight/night legibility,
mounted viewing distance, coarse touch/turbulence proxy, VoiceOver/TalkBack,
keyboard/pointer, permission UX, misleading stale/simulation states, and pilot
workflow review.

Human reviewers cannot approve their own implementation. Product acceptance
does not replace QA, Security/Privacy, Aviation, or Red Team approval.

## Traceability table template

| Requirement/hazard/threat | Test or protocol | Build/data | Result | Raw evidence | Defect/waiver | Reviewer |
|---|---|---|---|---|---|---|
| `PRD-NFR-route-250ms` | `PERF-ROUTE-01` | candidate/dataset | NOT RUN | pending | none | QA |
| `T-05 dataset replay` | `SEC-DATA-ROLLBACK-01` | candidate/manifest | NOT RUN | pending | none | Security |
| GPS-loss hazard | `LIFE-SENSOR-07` | candidate/trace | NOT RUN | pending | none | Red Team |

The repository may define stable IDs elsewhere later. Do not invent a passing
result to fill the table.

## Release summary template

```markdown
# Candidate <id>

Decision: PASS | FAIL | BLOCKED
Scope: <features, platforms, jurisdictions, dataset>
Limitations: <explicit non-certified and unavailable capabilities>

## Identity
- commit:
- app/native build:
- OTA/JS update:
- dataset manifest digest:
- artifact digest and verified provenance:

## Gates
| Gate | Status | Evidence | Owner |
|---|---|---|---|

## Performance
| Budget | Workload/device | median | p95 | worst | decision | trace |
|---|---|---:|---:|---:|---|---|

## Defects, hazards, and waivers
- <id, severity, effect, mitigation, expiry, approvals>

## Independent approvals
- QA:
- Security and Privacy:
- Aviation Domain:
- Red Team and Safety:
- Release owner:
```

## Retention and privacy

Retain evidence according to release/incident and legal policy, with longer
retention for shipped binaries, provenance, signed dataset manifests, critical
calculation fixtures, approvals, and safety decisions. Test accounts use
synthetic identities and coordinates. Before retention, scan logs, packet
captures, videos, screenshots, crash reports, and support artifacts for tokens,
precise real location, documents, aircraft registration, and personal data.

## Primary references

- [NIST SP 800-218, Secure Software Development Framework 1.1](https://doi.org/10.6028/NIST.SP.800-218)
- [GitHub: artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [Maestro CLI](https://docs.maestro.dev/maestro-cli)
- [FAA AC 120-76E](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-76E_FAA_Web.pdf)
