# Offline data lifecycle

An offline region is two independent facts: the currently active verified generation and the
state of any attempted update. A failed or interrupted update must never erase the last known
active generation.

## Lifecycle

1. Start a bounded download with a unique attempt ID and expected byte count.
2. Accept only monotonic progress for that attempt. Exact byte completion is required before
   verification starts.
3. Match the downloaded dataset ID, region, and jurisdiction to the signed manifest.
4. Verify signature metadata, digest, integrity timestamps, effective/expiry interval, and
   monotonic sequence policy.
5. Stage the verified generation without changing the active pointer.
6. Commit the generation records and active/prior pointers in one control-database transaction.
7. Emit `activation-committed` only after that transaction succeeds. Failed transfers and
   verification remain visible while the prior active generation stays usable if still current.

Rollback is rejected by default. A recovery workflow must explicitly authorize it before
staging; that authorization travels with the staged state and is rechecked at commit time.

## Fail-closed states

- Unknown, future, non-integer, or partially migrated control schemas stop initialization.
- Cross-attempt callbacks, regressing progress, oversize packages, incomplete downloads,
  dataset/region mismatches, malformed clocks, and invalid validity windows are rejected.
- Expired, not-yet-effective, malformed, and clock-indeterminate active generations remain on
  disk for diagnosis or recovery but are not reported as current.
- Quarantined generations cannot become active through the normal update path.

The package state machine is pure and platform-independent. Network, filesystem, signature,
digest, and SQLite adapters must report evidence into it; they do not redefine its policy.

## Registry read boundary

The System workspace now reads `control.sqlite` through a separate, read-only adapter. It joins
active pointers to generation records, reparses each manifest, and requires dataset ID, region,
jurisdiction, sequence, state, activation time, signature metadata, and manifest metadata to
agree. It then requires an exact manifest-to-file-row match for path, media type, byte count,
and SHA-256 before reporting a package. Recent transfer attempts are revalidated for bounded,
monotonic byte counts, status/failure consistency, required candidate IDs, and timestamp order.

Registry queries and manifests are bounded to 100 active packages, 10,000 active file rows, and
20 GiB aggregate package size. Excess collections fail closed. The manager states that the
filesystem has not been rehashed: registry metadata is not equivalent to a current filesystem
integrity check.

Until download, signature verification, app-private staging, digest streaming, filesystem
reconciliation, and atomic activation adapters exist, the manager is intentionally read-only.
The empty state says that no verified region is active and does not misclassify bundled
fictional fixtures as an aviation dataset.
