# Phase gate checklist

## How to use this checklist

This is a release-blocking checklist, not a roadmap progress counter. Mark each
item `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` and link raw evidence defined in
`RELEASE_EVIDENCE.md`. `N/A` requires a scope rationale and QA approval. No phase
may close with a blocker, unapproved critical defect, missing required evidence,
or unreviewed operationally significant change.

## Gate 0: candidate identity and scope

- [ ] Candidate is built from a reviewed commit and clean checkout.
- [ ] Platforms, OS/device matrix, jurisdiction, data sources, dataset versions,
      native build, OTA/JS update, and feature scope are frozen and recorded.
- [ ] Intended-use and non-certified limitations remain accurate and visible.
- [ ] All required checks have named owners and independent reviewers.
- [ ] Evidence manifest contains artifact, fixture, SBOM, provenance, and
      dataset-manifest digests.
- [ ] Open defects, hazards, threats, privacy changes, and waivers are listed.

## Gate 1: Phase 0 discovery and foundations

- [ ] Product, workflow, information architecture, architecture, aviation data,
      licensing, safety/limitations, threat, privacy, and test documents exist.
- [ ] System trust boundaries, data classes, mobile token storage, API boundary,
      location privacy, deletion/export, and supply-chain policy are reviewed.
- [ ] Dataset manifest defines signing roles/thresholds, canonical bytes,
      versions/expiry, length/SHA-256, rollback/freeze rejection, atomic
      activation, verification receipt, and root recovery.
- [ ] Core aviation models carry source, source/retrieval/effective/expiry time,
      dataset version, confidence, verification, jurisdiction, and origin.
- [ ] Critical calculations have reference/formula owners, explicit canonical
      units, independent-oracle plan, tolerances, and deterministic fixtures.
- [ ] Parser, offline, corruption, process-death, sensor, timezone/DST,
      accessibility, Maestro, performance, security, and privacy matrices are
      defined.
- [ ] Production data licences and redistribution constraints are distinguished
      from research suitability; unresolved paid/legal decisions are explicit.
- [ ] Architecture records the React Native/native differences; browser-only
      controls are not claimed for native mobile.
- [ ] Red Team has independently identified misleading-output release blockers.
- [ ] Phase status says no working app/tests where none exist.

## Gate 2: repository and CI foundation

- [ ] pnpm workspace uses strict TypeScript, formatting, lint, and reproducible
      frozen-lock installs in CI.
- [ ] CI actions are pinned immutably with minimum permissions; secret scanning,
      dependency/advisory and licence review are enforced.
- [ ] Release builds produce checksums, SBOM, provenance/attestation, and a
      separate verification result.
- [ ] Release bundle scan proves no provider secret, signing key, private API
      credential, debug bypass, or real user fixture is shipped.
- [ ] Framework-independent domain packages do not import React Native/UI.
- [ ] Test harness injects clock, monotonic time, tzdb, random, network, sensor,
      filesystem, locale/units, and dataset registry.
- [ ] Simulator/test-only controls are excluded from or cryptographically
      unreachable in production builds.

## Gate 3: Phase 1 navigable vertical slice

- [ ] Release development build runs on supported iOS Simulator and a physical
      iPhone/iPad; Android compatibility status is explicit.
- [ ] Clean install works without account/network/location permission for
      planning and simulation scope.
- [ ] Local airport adapter/schema validation, search/detail, route creation,
      route display, persistence, day/night, and explicit simulation work end to
      end with no placeholder controls.
- [ ] Geodesic, bearing, cross-/along-track, sequencing, route total, time, and
      unit suites pass golden, boundary, property, and independent-oracle checks.
- [ ] Malformed, out-of-range, NaN/infinite, antimeridian, polar, and zero-length
      inputs fail or calculate according to documented policy.
- [ ] GPS age/accuracy/source and loss degradation are visible; frozen values
      cannot appear live; simulation survives lifecycle without contaminating
      real state.
- [ ] Process death during route edit/navigation/simulation recovers safely.
- [ ] VoiceOver, Dynamic Type, rotation, split view, 48-point touch targets,
      colour-independent status, and non-drag alternatives have evidence.
- [ ] Cold launch, route recalculation, airport search, and map frame pacing have
      measured physical-device results with raw traces; budgets are not inferred.
- [ ] Required Phase 1 Maestro flows pass first-attempt review on frozen build.

## Gate 4: Phase 2 offline EFB foundation

- [ ] Offline packs show source/version/effective/expiry/licence/size and storage
      impact before download.
- [ ] Manifest signatures/thresholds, expiry/version, target length/SHA-256,
      schema/semantic checks and consistent snapshot are verified before use.
- [ ] Rollback, freeze, mix-and-match, wrong-role/key/signature, corrupt/partial,
      decompression-bomb, low-disk, and interrupted-download tests fail safely.
- [ ] Atomic activation kill-point matrix proves only old or new verified data
      becomes active and user data is preserved.
- [ ] SQLite integrity/migration/recovery and supported-version upgrade tests
      pass; corrupt data is quarantined with visible remediation.
- [ ] Required maps, airports, routes, aircraft, W&B, documents, checklists,
      saved flights, and simulation work offline for the declared duration.
- [ ] Imported documents/routes reject unsupported active/malformed/oversized
      content and do not create unintended network requests.
- [ ] Storage deletion by region cannot remove user-created data.

## Gate 5: Phase 3 weather and briefing

- [ ] METAR/TAF and each introduced product parser passes valid, unusual,
      malformed, partial, conflicting, fuzzed, and bounded-resource corpora.
- [ ] Observation/product, retrieval, animation frame, and expiry/stale times are
      distinct and visible with source and timezone semantics.
- [ ] Network replay, device clock rollback, timezone/DST change, multi-day
      offline, partial cache, and server failure cannot make stale weather fresh.
- [ ] Stale products stop any animation/presentation that implies currency.
- [ ] Strategic-weather limitations and unavailable data are visible and
      screen-reader accessible.
- [ ] Packet capture verifies weather requests/telemetry follow location privacy
      policy.

## Gate 6: Phase 4 performance and planning

- [ ] Wind triangle, TAS/GS, ETE/ETA, climb/cruise/descent, fuel, alternate,
      vertical profile, W&B, density/pressure altitude, and unit conversions have
      formula citations, typed inputs, independent fixtures, and properties.
- [ ] No aircraft-specific certified value is fabricated; generic/demo sources
      and limitations are persistent.
- [ ] Envelope boundaries, interpolation/extrapolation policy, negative/zero,
      extreme and mixed-unit inputs fail or warn explicitly.
- [ ] Route recalculation and interaction performance meet or have approved
      evidence-based disposition on physical reference hardware.
- [ ] Timezone/DST/date-line and magnetic/true distinctions pass full matrices.
- [ ] Plan edits preserve review/history and cannot silently replace active
      intent after invalid calculations.

## Gate 7: Phase 5 advanced situational awareness

- [ ] Terrain/obstacle sources, resolution, datum, coverage, age and uncertainty
      are visible and tested at gaps/boundaries.
- [ ] Sensor fusion handles drift, disagreement, outliers, stale/out-of-order
      values, calibration, loss, external-source switch, and permission revoke.
- [ ] Synthetic vision always displays `Experimental, not for navigation` and
      degrades/blocks when confidence is insufficient.
- [ ] Terrain/obstacle/runway highlighting cannot imply verified coverage where
      source or confidence is absent.
- [ ] Worst-case overlays meet measured frame, memory, thermal, battery, and
      endurance budgets on physical devices.
- [ ] Red Team and pilot/human-factors review independently challenge misleading
      attitude, altitude, terrain, runway, and GPS states.

## Gate 8: Phase 6 hardening and release

- [ ] Full build, typecheck, lint, unit, property, integration, native, Maestro,
      offline/failure, security/privacy, accessibility, performance, endurance,
      and safety suites pass on frozen candidate.
- [ ] iPhone/iPad layouts, orientations, split widths, supported Android devices,
      OS versions, permissions, screen readers, locale/timezone, and appearance
      matrix has no unexplained gap.
- [ ] Long navigation/download sessions cover memory leaks, thermal throttling,
      battery, storage growth, background limits, and OS process death.
- [ ] Authentication/token rotation/revocation/logout/restore/reinstall and
      two-account authorization tests pass.
- [ ] Location/SDK network capture, app-store privacy declarations, privacy
      manifests, telemetry consent/off switch, support-bundle redaction, export,
      and deletion reconciliation pass.
- [ ] Dataset and app signing key compromise/rotation/rollback incident drills
      complete with measured recovery and user communication.
- [ ] SBOM/advisory review, signed provenance and independent artifact
      verification match the shipped app and OTA/dataset releases.
- [ ] Operational monitoring detects integrity/auth/update failures without
      collecting precise location or secrets.
- [ ] Store copy, screenshots, help, and in-app limitations make no certified or
      primary-navigation claim.
- [ ] Known risks and time-bounded waivers have required independent approvals;
      no blocker is waived.

## Independent approval record

| Role | Required scope | Candidate decision/evidence |
|---|---|---|
| QA and Verification | reproducibility, matrix, defects, performance | pending |
| Security and Privacy | threats, API/storage/update/supply chain, privacy | pending |
| Aviation Domain | formula/source/jurisdiction/operational meaning | pending |
| Aeronautical Data | licence, provenance, update currency | pending |
| Red Team and Safety | misleading output and hazards | pending |
| Product/Release owner | scope, limitations, residual business risk | pending |

## Automatic release blocks

- Any plausible but incorrect live navigation, weather, runway, terrain,
  obstacle, unit, time, magnetic/true, or aircraft-performance output.
- Missing or bypassed dataset signature/integrity/expiry/version verification.
- Real/simulated source confusion, silent GPS/sensor loss, or stale data shown as
  current.
- Cross-account access, shipped secret, unintended precise-location disclosure,
  or incomplete export/deletion result claimed complete.
- Data loss, mixed-version activation, unrecoverable migration/corruption, or
  process-death recovery to ambiguous state.
- Missing raw evidence for a required test or performance claim.
- Safety-critical accessibility state unavailable to a supported user/input.

## Primary references

- [FAA AC 120-76E](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-76E_FAA_Web.pdf)
- [NIST SP 800-218, Secure Software Development Framework 1.1](https://doi.org/10.6028/NIST.SP.800-218)
- [The Update Framework specification](https://theupdateframework.github.io/specification/draft/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Maestro documentation](https://docs.maestro.dev/getting-started)
