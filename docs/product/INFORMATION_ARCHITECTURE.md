# Information architecture

## Navigation model

Driftline uses a stable workspace shell rather than a screen-for-screen copy of any existing
EFB. The map is one workspace, not the universal background.

### Primary workspaces

1. **Map** — position, route, layers, measure, nearest, and navigation strip.
2. **Plan** — route editor, brief, alternate, fuel/time, and validation.
3. **Places** — airport/fix search, airport dossiers, favourites, and nearby.
4. **Aircraft** — profiles, loading, performance scenarios, and limitations.
5. **Library** — documents, checklists, and offline packs.
6. **Flights** — saved plans, templates, recents, and logbook foundation.
7. **System** — data status, sensors, simulation, downloads, privacy, and help.

On iPad, a collapsible rail and two- or three-column content preserve map and plan context. On
iPhone, the same workspaces use a bottom bar plus drill-in stacks; a compact status capsule
remains reachable. Narrow iPad split view uses the iPhone composition without changing domain
behaviour.

## Global status plane

A persistent status plane reports:

- real, external, simulated, stale, or unavailable position source;
- horizontal accuracy and last fix age;
- active aviation dataset version and expiry;
- online/offline state and queued synchronization;
- weather source age when weather is visible;
- unresolved safety-blocking validation messages.

Selecting status opens evidence and remediation, not a generic settings screen.

## Map composition

The map owns geographic selection and inspection. A long press creates an inspection point; it
never changes the active route until the pilot selects a labelled route action. Layer controls
group base, aviation, weather, and personal content. Decluttering is level-based and always
preserves own-ship quality, active route, critical warnings, and selected objects.

The navigation strip is configurable but not styled as a certified flight instrument. Failed or
stale inputs show age and cause, never frozen convincing numbers.

## Planning composition

The plan is a versioned ordered list of route intents. Airways expand into derived legs but
retain their source token for later validation. Edits occur in a draft and produce a calculation
diff before replacing the active plan. Direct- to creates an explicit temporary plan state and
preserves the prior route.

## Content state grammar

Every data-bearing surface supports loading, ready, empty, stale, partial, unavailable,
permission-denied, corrupt, and simulated states. The same state grammar supplies visible text,
iconography, accessibility labels, and available actions.

## Safety-critical action hierarchy

- Immediate and reversible: pan, inspect, show/hide layer.
- Planning mutation: insert, remove, reorder, reverse, direct-to; always visible in route
  history.
- Data mutation: activate/delete pack, replace aircraft data; requires impact summary and
  confirmation.
- Unsupported operation: filing, certified navigation, authoritative performance; explained and
  unavailable rather than simulated as complete.
