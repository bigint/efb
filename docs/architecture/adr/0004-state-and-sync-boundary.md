# ADR-0004: state ownership and synchronization boundary

- Status: proposed
- Date: 2026-07-14

## Context

The mandated stack includes Zustand and TanStack Query alongside SQLite and
MMKV. Without strict ownership, the same route or weather record can acquire
four conflicting copies, optimistic updates can disappear after process death,
and network cache freshness can be mistaken for aviation validity.

## Decision

Assign each state class one authority:

| State | Owner | Examples |
|---|---|---|
| Durable local user intent | `user.sqlite` | routes, aircraft, loading scenarios, documents/checklists, sync outbox |
| Published offline data | active immutable generation selected by `control.sqlite` | airports, runways, airspace, navaids, tiles |
| Small rebuildable preference | MMKV | theme, declutter, panel layout, last screen hint |
| Ephemeral interaction/session | scoped Zustand stores | selected feature, open sheet, draft geometry, latest presentation snapshot |
| Remote request lifecycle/cache | TanStack Query | account, entitlement, manifest discovery, current remote weather fetch |
| Secret | OS credential facility | access/refresh tokens, private keys |
| Derived output | pure calculation/read model | active leg, ETA, W&B result, formatted presentation |

Zustand is not a database. Stores are feature/session scoped, expose actions
instead of arbitrary mutation, and use selectors to avoid high-frequency global
rerenders. High-rate raw position history does not enter a general store; a
navigation service publishes the latest bounded presentation snapshot.

TanStack Query is not the aviation truth store. Its `staleTime`, `gcTime`, and
network status control fetching behavior, not meteorological or dataset
validity. Query data carrying operational relevance includes source time,
retrieval time, validity/expiry, jurisdiction, confidence, verification, and
origin. The view derives `fresh | stale | expired | unknown` from product rules
and an injected clock even when TanStack considers the query cache fresh.

Persisting the entire query cache to MMKV is prohibited. It may exceed the
intended small synchronous store and can silently disappear through cache
busters/age rules. Selected cacheable online products use an explicit SQLite
repository with product-specific retention and provenance; TanStack Query reads
through that repository/network adapter.

### Local-first mutation and outbox

User-authored changes commit locally before network sync:

1. Validate input and convert units at the boundary.
2. In one `user.sqlite` transaction, write the entity revision and an outbox
   operation containing stable operation ID, entity ID/type, base revision,
   payload schema version, device ID, and client timestamp.
3. Commit, publish/invalidate the local read model, and report saved-offline.
4. A sync coordinator runs only when authenticated and reachable, sends
   idempotent batches in causal order, and records acknowledgements in SQLite.
5. Server conflicts return current/base revisions and never become blind last-
   write-wins. Apply an entity-specific deterministic policy or create an
   explicit conflict for resolution.

Route edits, log entries, aircraft profiles, and checklist completion require
separate merge policies. Published aviation data and dataset generations do not
travel through this user outbox. Remote weather is cached, not synchronized as
user intent.

TanStack mutations may orchestrate a sync attempt, but optimistic UI is backed
by the committed local row/outbox, so process death cannot erase accepted user
intent. Paused TanStack mutations are not the durable queue.

### Connectivity and lifecycle

Wire TanStack Query's `onlineManager` to React Native connectivity and
`focusManager` to app state, as its React Native guidance requires. Treat
connectivity as a scheduling hint: a network interface does not prove the API
or weather source is reachable. Retry only idempotent operations with bounded
backoff and jitter; honor server retry instructions. Foregrounding triggers
selective revalidation, not an indiscriminate request storm.

## Dependency and API boundary

- Feature services accept repository, clock, connectivity, and sync ports. They
  do not import Zustand or TanStack Query.
- React hooks adapt services/read models to UI state. Components do not issue
  SQL or construct outbox operations.
- The API consumes `data-contracts` schemas and returns explicit versions and
  conflict results. Mobile does not share server ORM models.
- Query keys are generated centrally from IDs, jurisdiction, units-independent
  canonical parameters, and dataset/source versions where relevant.
- Cache invalidation follows committed domain events. It is not used as the
  durable event log.

## Performance budgets

- A sensor tick performs <= 5 ms p95 JS work and does not cause unrelated screen
  rerenders. Position-to-visible ownship remains <= 100 ms p95.
- Local mutation plus outbox commit targets <= 100 ms p95 for ordinary records;
  UI feedback begins immediately and shows durable-save progress if slower.
- Foreground revalidation starts only visible/critical queries first and must not
  delay the <= 3 s recoverable shell.
- Zustand selectors and TanStack tracked results are profiled; no store holds an
  unbounded sample, tile, weather-frame, or query history.
- Sync batches are bounded by operation count and bytes, cancelable, and yield to
  navigation/database reads.

## Failure recovery

- On process death, committed entity + outbox rows replay; uncommitted drafts are
  either explicitly autosaved to a draft table or honestly lost, never shown as
  saved.
- Duplicate requests are safe because operation IDs are idempotency keys.
- Authentication expiry pauses outbox delivery without deleting it. Sign-out
  distinguishes remove-from-device from preserve-local and follows a documented
  privacy flow.
- Cache corruption/eviction causes a refetch or explicit unavailable state; core
  offline records remain in authoritative SQLite.
- Conflict records retain local/base/server revisions until resolved and audited.
- Clock changes cannot make data fresh by accident: age evaluation records
  source UTC time, retrieval UTC time, and monotonic elapsed time during the
  current process, and treats contradictory clocks as uncertain.
- If the backend is unavailable, all core offline actions continue; cloud-only
  status is visibly unavailable/waiting.

## Alternatives considered

- **Put all state in Zustand with persistence:** lacks relational transactions
  and durable outbox semantics; rejected.
- **Use TanStack Query for SQLite and network authority alike:** possible as a
  UI adapter, but cache lifecycle must not become data lifecycle; rejected as an
  authority model.
- **Server-first writes with optimistic UI:** loses offline core behavior and can
  accept intent only in memory; rejected.
- **Blind last-write-wins:** can silently discard safety-relevant user changes;
  rejected as a universal policy.
- **General event sourcing:** adds complexity before audit/replay needs justify
  it. Use revisioned entities plus an outbox and immutable planning snapshots.

## Implementation sequence

1. Define the ownership table in code conventions and add an architecture test
   preventing feature/domain imports of UI state libraries.
2. Implement user repositories, revision columns, transactional outbox, stable
   IDs, injected clock, and local read-model invalidation.
3. Build feature-scoped Zustand stores for the Phase 1 map/route session.
4. Add TanStack Query with native focus/connectivity adapters for manifest and
   weather discovery; keep product-validity evaluation separate.
5. Fault-test process death, duplicate replay, auth expiry, cache eviction,
   conflicts, network flapping, and clock changes.
6. Implement the API sync protocol only after entity-specific conflict policies
   and account deletion/export requirements are reviewed.

## References

- [TanStack Query: React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
- [TanStack Query: network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [TanStack Query: persisted client behavior](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
- [Zustand documentation](https://zustand.docs.pmnd.rs/)
- [SQLite transactions](https://www.sqlite.org/lang_transaction.html)
