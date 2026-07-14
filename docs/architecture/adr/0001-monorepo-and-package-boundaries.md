# ADR-0001: pnpm monorepo and package boundaries

- Status: proposed
- Date: 2026-07-14
- Owners: Chief Architect; package owners enforce their public contracts

## Context

Driftline combines platform UI, pure aviation calculations, native device
integration, persistence, data validation, and an optional backend. Safety-
relevant formulae must run in deterministic tests outside React Native, while
native and framework dependencies will change on different release cadences.
Unconstrained workspace imports would make those requirements unverifiable.

## Decision

Use a pnpm workspace with the following initial boundaries:

```text
apps/mobile                 Expo Router composition root and presentation
apps/api                    optional sync/distribution HTTP composition root
packages/aviation-domain    units, identities, provenance, clocks, domain errors
packages/data-contracts     Zod wire/file schemas and version negotiation
packages/geospatial         pure geodesic/spatial calculations
packages/weather            validated weather domain and parsers
packages/flight-planning    pure route/leg/wind/time/fuel planning
packages/aircraft-performance generic loading/performance calculations
packages/database           SQLite schemas, migrations, repositories, outbox
packages/native-platform    typed JS facade plus Expo Swift/Kotlin module
packages/design-system      platform UI tokens and primitives
packages/testing            fixtures and test helpers, never production runtime
packages/config             build-time lint/TypeScript/test configuration
```

Repository ingestion/build tooling may later live under `tools/` or a dedicated
app; it must not be imported into the mobile bundle.

### Dependency rules

1. `apps/*` compose packages. No package imports an app.
2. `aviation-domain` imports no other runtime workspace package and no UI,
   storage, network, or native framework.
3. `data-contracts` validates external representations and remains independent
   of application state. Adapters explicitly map validated DTOs into domain
   types; parsing does not grant confidence.
4. `geospatial` may depend only on `aviation-domain` at runtime.
5. `weather` may depend on `aviation-domain` and `data-contracts`.
6. `flight-planning` may depend on `aviation-domain` and `geospatial`.
7. `aircraft-performance` may depend only on `aviation-domain`.
8. `database` is an outer adapter and may depend on domain/feature contracts.
   Domain packages never import it. Repository interfaces are accepted by
   application services at the composition root rather than provided through a
   global service locator.
9. `native-platform` is an outer adapter used by `apps/mobile`. Pure packages
   never import it.
10. `design-system` is domain-neutral. Operational presentation adapters in
    `apps/mobile` convert domain state into explicit display models.
11. `testing` may depend on production packages; production packages must not
    depend on `testing` except through test-only imports excluded from exports.
12. Public package exports are explicit. Deep imports into `src/` and cyclic
    workspace dependencies fail CI.

Each critical calculation receives an immutable input snapshot with explicit
canonical units, clock/time basis, dataset/formula version, and source status.
It returns a value or a typed failure/degraded result; it does not read global
state, the wall clock, a database, or the network.

## Performance and operability consequences

- Pure packages can be benchmarked in Node and on-device. The ordinary route
  recalculation gate is <= 250 ms p95 for the agreed <= 100-leg fixture.
- Mobile startup imports only public entry points. Feature entry points should
  be narrow so document/weather/performance code does not inflate the initial
  map route unnecessarily.
- Boundary DTO mapping has a cost; validate once at trust boundaries and pass
  typed objects internally instead of repeatedly parsing during render.
- Workspace constraints require an import graph check, strict TypeScript project
  references or equivalent build ordering, and bundle-size reporting in CI.

## Failure recovery

- A package contract or stored schema change requires an explicit version and
  migration. Unsupported versions fail closed with an actionable recovery path.
- Calculation failures are typed domain results; presentation must not convert
  an exception or unknown unit into zero, last-known-current, or an empty
  success state.
- App composition may disable a failing optional adapter while keeping pure
  offline modules available. It may not substitute fixture data outside an
  unmistakable simulator/development mode.

## Alternatives considered

- **Single application package:** initially faster, but makes native/storage/UI
  coupling and duplicate calculations likely; rejected.
- **Microservices for every domain:** creates deployment and network dependency
  without Phase 1 value; rejected. The mobile core is a modular monolith.
- **One package per entity/use case:** maximizes ceremony and graph churn;
  rejected until measured ownership or build needs justify a split.
- **Shared catch-all package:** becomes an unowned dependency sink; prohibited.

## Implementation sequence

1. Create workspace/config, strict compiler options, export maps, owner metadata,
   and import-cycle/boundary checks.
2. Create the two foundation packages and unit/provenance contracts.
3. Implement geospatial and flight-planning pure slices with golden/property
   tests before UI integration.
4. Add database and native adapters, then compose them in `apps/mobile`.
5. Add API only after sync contracts and offline mutation semantics are defined.

## Revisit when

A package has independent release consumers, native build isolation is painful,
or a performance profile shows entry-point/bundle costs that the current graph
cannot address. Splitting must preserve dependency direction.

## References

- [pnpm workspaces](https://pnpm.io/workspaces)
- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Node.js package exports](https://nodejs.org/api/packages.html#package-entry-points)
