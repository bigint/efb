# Checklist foundation

The Library workspace stores only user-authored checklists. Driftline bundles no real-aircraft
normal, abnormal, or emergency procedure content. Every template and active run is labelled
`unverified`, including user-selected emergency categories.

## Model

- A template records its aircraft/source label, category, ordered challenge/response items,
  critical-item flags, timestamps, and revision.
- Authoring can link one of at most 100 validated local aircraft profiles. A linked template
  stores the profile UUID and derives its visible label from that profile's normalized
  registration; free-text source labels remain available when no profile is selected or profile
  reads fail.
- Item sequences are contiguous from zero and bounded to 100 items. Empty templates do not cross
  the domain or SQLite read boundary.
- Starting a run embeds the complete validated template snapshot, template revision, and item
  count. Later template changes cannot alter the procedure a historical run displayed.
- User-authored templates can be loaded back into the authoring form and saved only as the next
  revision. Identity, creation time, source, and unverified status remain immutable. A
  compare-and-swap update revises metadata and replaces all ordered items in one exclusive
  transaction; a stale writer changes no items. Any open or terminal run continues to display
  its original full snapshot and revision.
- Completion sequences are unique and in range. A completion time exists only when all snapshot
  items are checked, cannot precede start, and locks the completed run.
- An incomplete run may be explicitly abandoned after native destructive confirmation. Its
  abandonment timestamp, checked-item subset, snapshot, and revision remain immutable in
  terminal history; it is never relabelled complete or deleted.
- Each toggle increments a state revision. SQLite persists it with a compare-and-swap update;
  stale views roll back and reload instead of overwriting newer completion state.
- Changed completion rows are inserted or removed inside the same exclusive transaction while
  unchanged item timestamps are preserved.
- The Library exposes at most 20 recent completed or abandoned runs as read-only locked
  snapshots. History rows and their relational completions are read in one exclusive
  transaction. Open-run completions use a 101st sentinel row; terminal history uses a
  `run limit × 100 + 1` sentinel, so a corrupt relation cannot cause an unbounded read or silent
  truncation. Results are decoded through the same domain boundary as an active run, and a
  malformed historical row disables only the history view rather than hiding otherwise valid
  templates or the open run. Each row can expand its immutable snapshot to show start/terminal
  UTC, elapsed seconds, state/template revision, full challenge/response text, critical flags,
  and the exact completed/unchecked outcome for every item. Expansion never creates a transition
  or reads the current mutable template.
- The active template collection is bounded to 100 templates and 10,000 item rows. Items are
  joined only from non-deleted templates, and both relations are reconstructed inside one
  exclusive read snapshot. A concurrent template replacement cannot create a mixed-version view,
  and an obsolete soft-deleted template cannot poison the active library read.

## Migration

User database migration v3 adds category, source, verification, aircraft label, run item count,
snapshot JSON, and state revision to the original checklist tables. Legacy templates are mapped
conservatively to user-authored/unverified; legacy runs receive deterministic ordered snapshots.
Migration v6 adds the abandonment timestamp and a partial unique expression index that permits
at most one run with neither completion nor abandonment. Executable migration tests verify the
preserved snapshot and the one-open-run constraint.

## Open release work

Physical-device process-death and concurrent-view tests, recovery during abandonment, retaining
the full template-revision lineage outside run snapshots, handling a later-renamed aircraft
profile, export/backup, VoiceOver sequencing, Dynamic Type, and comparison against approved
aircraft material remain open. A saved checklist is not approved merely because every box is
checked.
