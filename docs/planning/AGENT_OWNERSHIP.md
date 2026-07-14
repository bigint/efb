# Specialist ownership and integration policy

## Coordination rules

- Each parallel assignment uses a dedicated `agent/<role>` branch and isolated worktree.
- One role owns each architectural file during an assignment. Cross-cutting suggestions are
  returned as findings, not edits to another role's files.
- The Chief Architect reviews interfaces and dependency direction; the primary integrator
  reviews and merges commits into `main`.
- QA and Red Team reviews are independent phase gates and do not self-approve implementation
  work.
- Every handoff reports findings, assumptions, files changed, tests added, risks, recommended
  next action, sources where applicable, and commit hash.

## Role map

| Role                            | Primary ownership                     | Phase 0 output                         | Initial implementation output         |
| ------------------------------- | ------------------------------------- | -------------------------------------- | ------------------------------------- |
| Chief Architect                 | boundaries, ADRs, sequencing, budgets | architecture and dependency decisions  | integration review                    |
| Aviation Domain Lead            | terminology, operations, jurisdiction | domain and limitation model            | domain contract review                |
| Aeronautical Data Research Lead | sources and licences                  | source matrix and pipeline constraints | adapter acceptance criteria           |
| Geospatial and Navigation Lead  | geometry, map, indexing               | calculation and renderer plan          | pure geospatial package and map slice |
| Weather Systems Lead            | products, parsers, age                | product/time/cache model               | parser fixtures and weather package   |
| Flight Planning Lead            | routes, winds, phases                 | route state model                      | planner package and route editor      |
| Aircraft Performance Lead       | generic loading/performance           | source and envelope policy             | generic tested model                  |
| Mobile Platform Lead            | devices, sensors, lifecycle           | platform capability matrix             | app shell, permissions, recovery      |
| Product Design Lead             | system, ergonomics, accessibility     | tokens and interaction spec            | reusable design system                |
| Backend and Sync Lead           | optional account/sync services        | sync contract and offline boundary     | API skeleton after mobile need exists |
| Security and Privacy Lead       | threat/privacy/supply chain           | threat model                           | security gates and storage policy     |
| QA and Verification Lead        | deterministic verification            | test strategy and release evidence     | harnesses and phase verification      |
| Red Team and Safety Review Lead | hazardous misleading output           | hazard log and release blocks          | independent milestone review          |

## File ownership for Phase 0

- `docs/architecture/**`: Chief Architect
- `docs/aviation/DOMAIN_MODEL.md`, `JURISDICTION_MATRIX.md`, `OPERATIONAL_LIMITATIONS.md`,
  `CALCULATION_REFERENCE_PLAN.md`: Aviation Domain Lead
- `docs/aviation/DATA_SOURCE_MATRIX.md`, `DATA_PIPELINE_AND_LICENSING.md`: Aeronautical Data
  Research Lead
- `docs/product/**`: Product Design Lead or primary integrator by explicit file
- `docs/security/**`: Security and Privacy Lead
- `docs/testing/**`: QA and Verification Lead
- `docs/safety/**`: Red Team and Safety Review Lead
- `docs/status/PROJECT_STATUS.md`: primary integrator only

## Integration checklist

1. Confirm branch base and changed paths.
2. Read every changed file and validate primary sources/licence statements.
3. Resolve conflicting assumptions before code adopts them.
4. Cherry-pick the reviewed commit; never copy an unreviewed worktree wholesale.
5. Run documentation checks and repository gates.
6. Update status, decisions, risks, and next ownership batch.
