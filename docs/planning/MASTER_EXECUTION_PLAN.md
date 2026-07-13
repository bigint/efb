# Master execution plan

This plan is intentionally provisional until the Phase 0 specialist reviews are
integrated.

1. Establish research, safety, data-licensing, architecture, design, security,
   and test foundations.
2. Initialize the strict TypeScript/pnpm monorepo and automated quality gates.
3. Deliver a navigable offline-first vertical slice with explicit simulation and
   non-certified status.
4. Add versioned offline datasets, weather, planning, performance, terrain, and
   hardening in gated phases.
5. Require build, test, failure-mode, accessibility, performance, and safety
   evidence before closing any phase.

## Dependency graph

```mermaid
flowchart TD
  R["Phase 0 research"] --> A["Architecture and contracts"]
  R --> S["Safety and limitations"]
  R --> D["Data licensing and adapters"]
  A --> M["Monorepo and CI"]
  S --> M
  D --> O["Offline data pipeline"]
  M --> V["Phase 1 vertical slice"]
  D --> V
  V --> O
  V --> W["Weather and briefing"]
  V --> P["Performance and planning"]
  O --> T["Terrain and situational awareness"]
  W --> H["Hardening"]
  P --> H
  T --> H
```

