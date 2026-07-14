# Phase 1 recovery follow-up — candidate `2b801c5`

## Decision

**All three targeted defects are CLOSED for the reproduced source/unit scenarios.** Frozen
candidate `2b801c5952b0c074acef3ba39089fce371cec850` passes the exact prior malformed-MMKV,
non-finite-position, and duplicate-persisted-route probes. `pnpm verify` also passes.

This follow-up is intentionally limited to `P1-RR-01`, `P1-RR-02`, and `P1-RR-03`. It does not
reassess or change any other phase-gate decision.

## Reproduced results

| Defect                               | Decision   | Exact probe result                                                                                                                                                                                                | Candidate control                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `P1-RR-01` malformed MMKV JSON       | **CLOSED** | Mocked MMKV `getString()` returned `'{malformed-json'`. Full store hydration recovered to `positionScenario: { kind: 'disabled' }`, `positionSample: null`, empty route, null airport, and `workspace: 'system'`. | The storage adapter sanitises malformed JSON before Zustand deserialisation ([`apps/mobile/src/store/flight-store.ts:33-40`](../../apps/mobile/src/store/flight-store.ts)); malformed input becomes the explicit safe envelope ([`apps/mobile/src/domain/persisted-flight.ts:15-20`](../../apps/mobile/src/domain/persisted-flight.ts), [`apps/mobile/src/domain/persisted-flight.ts:44-51`](../../apps/mobile/src/domain/persisted-flight.ts)). |
| `P1-RR-02` NaN sample/clock          | **CLOSED** | The exact combined NaN `sampledAt`/accuracy sample returned `{ kind: 'unavailable', reason: 'sample-invalid' }`; a NaN evaluation clock returned `{ kind: 'unavailable', reason: 'clock-invalid' }`.              | Evaluation now rejects a non-finite clock and validates every numeric sample field before age calculation ([`apps/mobile/src/domain/position-source.ts:35-65`](../../apps/mobile/src/domain/position-source.ts)). Permanent regressions cover NaN sample time/accuracy and clock ([`apps/mobile/src/domain/position-source.test.ts:37-54`](../../apps/mobile/src/domain/position-source.test.ts)).                                               |
| `P1-RR-03` duplicate persisted route | **CLOSED** | Full store hydration of a valid version-2 envelope containing `['DVL1', 'DVL1']` recovered to disabled/null/empty/System state; no duplicate route reached render-time calculation.                               | Persisted route identifiers must be unique, and any invalid state parses to the safe state ([`apps/mobile/src/domain/persisted-flight.ts:22-42`](../../apps/mobile/src/domain/persisted-flight.ts)). Permanent recovery tests include the duplicate route ([`apps/mobile/src/domain/persisted-flight.test.ts:16-28`](../../apps/mobile/src/domain/persisted-flight.test.ts)).                                                                    |

The four assertions across three temporary diagnostic files passed. The files and temporary
Vitest alias configuration were removed after execution.

## Repository verification

`pnpm verify` passed after removal of all diagnostics:

- Prettier: pass.
- ESLint: pass with zero warnings.
- Strict TypeScript: pass across eight implementation projects.
- Vitest: 10 test files / 60 tests pass in 207 ms.

## Targeted conclusion

`P1-RR-01`, `P1-RR-02`, and `P1-RR-03` require no further source/unit remediation for the exact
regressions reported in the prior review. Any broader lifecycle or device evidence remains
outside this follow-up's scope.
