# Phase 1 milestone red-team review

## Decision

**BLOCK — Phase 1 must remain open.**

The candidate is appropriately described in repository copy as a fictional development slice,
and its static quality checks pass. It is not safe to close the navigable-vertical-slice gate
because a user can disable simulation while fabricated ownship, groundspeed, and GPS altitude
remain on the map. The build also lacks a position freshness/accuracy/source model, silently
changes persisted routes when identifiers cannot be resolved, presents a non-functional
`NEAREST` claim, and has no UI/lifecycle evidence for the safety-significant states.

This is a milestone decision, not a claim that the repository should stop development. The
current build may be used only as a controlled internal design/architecture demonstration with
its existing limitations visible.

## Gate assessment

| Phase 1 criterion                                                 | Result  | Evidence / disposition                                                                                   |
| ----------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| Native iOS simulator and physical iPhone/iPad                     | NOT RUN | No raw native build/device evidence was produced in this review.                                         |
| Clean install without network/account/location                    | NOT RUN | Static architecture suggests a fixture-only path; clean-install behavior was not exercised.              |
| Airport validation/search/detail, route, persistence, themes, sim | FAIL    | Slice exists, but `NEAREST` is a placeholder and persisted unresolved route IDs are silently omitted.    |
| Geodesic/bearing/track/route/unit suites                          | FAIL    | 17 tests pass, but golden/boundary/property/oracle coverage required by the gate is incomplete.          |
| Malformed, non-finite, antimeridian, polar, zero-length policy    | FAIL    | Some fail-closed tests exist; semantic airport, polar, antimeridian, and 0/1-route UI policies are open. |
| GPS age/accuracy/source/loss and real/simulation isolation        | FAIL    | Critical source-confusion and missing freshness model; see H-001 through H-003.                          |
| Process-death recovery                                            | NOT RUN | GPS outage resets healthy and route/source recovery has no safety test.                                  |
| Accessibility, Dynamic Type, rotation, split view, touch targets  | NOT RUN | Some labels/target tokens exist; no raw matrix evidence was reviewed.                                    |
| Physical-device performance                                       | NOT RUN | No traces or physical-device measurements were reviewed.                                                 |
| Required Maestro flows                                            | NOT RUN | No Maestro suite/evidence exists in the reviewed tree.                                                   |
| Independent misleading-output review                              | FAIL    | Completed by this report; 10 blocking high/critical hazards remain open.                                 |

## Highest-priority release blockers

1. **Unify source truth.** `simulationEnabled`, `gpsOutage`, ownship, nav values, and status
   wording currently disagree. Replace the independent booleans with an atomic source/sample
   state machine and make unavailable the safe default.
2. **Add freshness and accuracy.** Every position-dependent value needs
   sample/source/age/accuracy policy. Test GPS loss, stale/frozen samples, permission changes,
   backgrounding, process death, and clock rollback.
3. **Separate route intent from ownship.** Empty/incomplete routes must not invent a location or
   display undefined time as zero. Unresolved persisted waypoints must remain visible and block
   recalculation.
4. **Remove unsupported claims.** Rename `NEAREST` until it actually ranks from a fresh ownship.
   Render no directional aircraft until valid track/heading exists, with true/magnetic reference
   explicit.
5. **Harden data acceptance.** Unknown expiry cannot mean current, invalid provenance cannot
   flow as usable, and airport/runway cross-field contradictions must quarantine the record.
6. **Produce evidence.** Add failure-oriented core tests, mobile state/UI tests, Maestro flows,
   accessibility checks, and frozen-build physical-device artifacts. A green static verify run
   is necessary but not sufficient.

## Required re-review packet

Before Red Team reconsideration, provide:

- a candidate commit and build identity;
- hazard-to-test mapping for H-001 through H-012 in `HAZARD_LOG.md`;
- state-transition evidence for simulated/device/external/unavailable position sources;
- 0/1/2-waypoint and unresolved-persisted-route UI evidence;
- malformed airport and provenance corpus results;
- true/magnetic and units/precision policy with independent fixtures;
- iPhone and iPad screenshots/recordings for GPS outage, stale fix, no fix, simulation, and
  simulation-off states, including VoiceOver;
- native process-death/background/permission-revoke results; and
- the complete `pnpm verify` output plus Maestro and physical-device performance artifacts.

## Checks performed

- Read all mobile workspaces/store and all core aviation, data-contract, flight-planning, and
  geospatial source/tests.
- Searched production code for location consumption, simulation/GPS gating, accuracy/age,
  magnetic/true reference, stale/provenance use, and claim-bearing controls.
- Ran `pnpm verify` successfully on 2026-07-14 in the isolated review worktree:
  - Prettier: pass
  - ESLint: pass
  - strict TypeScript across six implementation projects: pass
  - Vitest: 4 files, 17 tests: pass
- Did not run a native simulator, physical device, Maestro, screen reader, sensor injection, or
  performance trace. Those results must remain `NOT RUN`, not inferred from source or unit
  tests.

## Residual risk if used as an internal demo

The no-chart, fictional-data, non-certified, and demonstration warnings are good controls, but
the cockpit-style map can still visually outrank those warnings. A supervised demo should begin
and end with simulation on, should not describe any readout as live, and should not demonstrate
simulation-off or `NEAREST` as functional behavior. Screenshots must retain the top source
status and `OFFLINE DEMO GRID / No chart data loaded` warning.

## Independent reviewer conclusion

The implementation is a credible architecture/design seed, not yet a credible navigable vertical
slice. The strongest near-term safety improvement is not more aviation data or map polish; it is
a single fail-closed truth model that prevents fabricated, stale, and unavailable position state
from ever looking live.
