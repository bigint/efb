# Checklist foundation

The Library workspace stores only user-authored checklists. Driftline bundles no real-aircraft
normal, abnormal, or emergency procedure content. Every template and active run is labelled
`unverified`, including user-selected emergency categories.

## Model

- A template records its aircraft/source label, category, ordered challenge/response items,
  critical-item flags, timestamps, and revision.
- Item sequences are contiguous from zero and bounded to 100 items. Empty templates do not cross
  the domain or SQLite read boundary.
- Starting a run embeds the complete validated template snapshot, template revision, and item
  count. Later template changes cannot alter the procedure a historical run displayed.
- Completion sequences are unique and in range. A completion time exists only when all snapshot
  items are checked, cannot precede start, and locks the completed run.
- Each toggle increments a state revision. SQLite persists it with a compare-and-swap update;
  stale views roll back and reload instead of overwriting newer completion state.
- Changed completion rows are inserted or removed inside the same exclusive transaction while
  unchanged item timestamps are preserved.
- The Library exposes at most 20 recently completed runs as read-only locked snapshots. History
  rows and their relational completions are read in one exclusive transaction, decoded through
  the same domain boundary as an active run, and a malformed historical row disables only the
  history view rather than hiding otherwise valid templates or the open run.

## Migration

User database migration v3 adds category, source, verification, aircraft label, run item count,
snapshot JSON, and state revision to the original checklist tables. Legacy templates are mapped
conservatively to user-authored/unverified; legacy runs receive deterministic ordered snapshots.
Executable migration tests verify the preserved snapshot.

## Open release work

Physical-device process-death and concurrent-view tests, template revision/edit UI, explicit run
abandonment, detailed history inspection, export/backup, VoiceOver sequencing, Dynamic Type, and
comparison against approved aircraft material remain open. A saved checklist is not approved
merely because every box is checked.
