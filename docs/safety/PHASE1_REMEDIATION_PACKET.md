# Phase 1 safety remediation packet

## Scope and decision status

This packet records the first remediation candidate after the independent Red Team, QA, and
product-design reviews of candidate `e96a2e2`. It does not close Phase 1 and does not approve
operational navigation. Native-device, lifecycle, accessibility, Maestro, performance, and
independent calculation-oracle evidence remain outstanding.

## Hazard-to-control mapping

| Hazard | Implemented control                                                                                                                         | Automated evidence                                                      | Disposition before re-review                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| H-001  | One atomic position scenario/sample model; disabling simulation clears the sample; map, status, and System derive from one evaluation       | `apps/mobile/src/domain/position-source.test.ts`                        | Source-confusion code path remediated; native transition evidence open              |
| H-002  | Samples have source, timestamp, accuracy, and a 3 s freshness limit; samples are never persisted; corrupt persisted state fails to disabled | Position-source boundary tests                                          | Core boundary remediated; background/process-death evidence open                    |
| H-003  | Ownship is hidden unless the sample is valid; the remaining simulated glyph is non-directional and has no invented accuracy rings           | Position-source tests plus source inspection                            | Code control implemented; screenshot/accessibility evidence open                    |
| H-004  | Empty and one-point routes return null distance/ETE with explicit `empty`/`incomplete` state; ownship is independent of route               | `packages/flight-planning/src/route.test.ts`                            | Calculation boundary remediated; UI automation open                                 |
| H-005  | Currency is classified as current/expired/not-effective/unknown/invalid; unknown is never current; invalid records are rejected             | `packages/data-contracts/src/confidence.test.ts`, airport adapter tests | Core boundary remediated; chronology corpus incomplete                              |
| H-006  | Canonical identifier casing, IANA timezone, unique runway identities, and invalid-provenance rejection                                      | `packages/aviation-domain/src/airport.test.ts`                          | Partially remediated; runway reciprocal/heading and operational-bound policies open |
| H-007  | Displayed runway heading carries an explicit `°T` label                                                                                     | Source inspection                                                       | Partial only; distinct true/magnetic types and magnetic model remain open           |
| H-008  | Unsupported `NEAREST` claim renamed to `PLACES`                                                                                             | Source inspection                                                       | Remediated for current scope                                                        |
| H-009  | Resolution is atomic; unresolved identifiers remain visible and block all route calculation                                                 | `packages/flight-planning/src/route.test.ts`                            | Core boundary remediated; persisted UI automation open                              |
| H-010  | Position values carry explicit simulated units and route results distinguish undefined values                                               | Route and position tests                                                | Partial; provenance-driven precision policy remains open                            |
| H-011  | Map retains `OFFLINE DEMO GRID` and `No chart data loaded`; unresolved route state is dominant                                              | Source inspection                                                       | Demo control only; native map failure fallback remains open                         |
| H-012  | Permanent property, state, route, provenance, airport-semantic, dataset-activation, and weight-and-balance tests added                      | 44 tests across 9 files                                                 | Improved, not closed; independent oracle, UI, and native suites remain open         |

## Verification record

- `pnpm verify`: pass on 2026-07-14; Prettier, ESLint, strict TypeScript, and 44 tests across 9
  test files.
- Expo Doctor: 20/20 checks pass.
- Production iOS JavaScript/Hermes export: pass; 2,059 modules and a 4.9 MB reported bundle.
- Hermes bundle SHA-256: `00e32db4ee724681000b0a505ce30fae3ef3c398be21b421c39ac46d368103c8`.
- Export metadata SHA-256: `e284b15969af248a9e42f94b8a910d3a828f0cefeca2a5c0266a0e4edb12ee60`.
- `pnpm audit --audit-level high`: pass; one transitive moderate vulnerability remains recorded
  in the implementation security review.

## Required independent re-review

Reviewers should treat this as a code-remediation candidate, not a Phase 1 completion packet.
They should reproduce the static gates, inspect every H-001 through H-012 control, and
explicitly separate source-level remediation from evidence that still requires a native
simulator, physical device, screen reader, lifecycle interruption, or external calculation
oracle.
