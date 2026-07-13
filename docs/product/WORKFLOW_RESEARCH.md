# Workflow research notes

## Research boundary

This research extracts safety and human-factors constraints from public primary
guidance. It does not reverse engineer, reproduce, or benchmark a competitor's
proprietary interface. Familiar EFB capabilities are treated as pilot tasks and
redesigned within Driftline's own workspace model.

## Evidence translated into requirements

### Data and software lifecycle are product features

FAA AC 120-76E calls for database version, effective date, valid period, quality
control, revision control, tested software/OS changes, and safeguards against
corruption. Driftline therefore treats dataset activation as a visible,
versioned transaction with checksum verification, an operational lockout,
rollback, and a user-readable provenance record. An update may download in the
background but must not activate while a simulated or real navigation session is
active.

### Own-ship must degrade, not freeze

The FAA guidance says directionality should disappear when track or heading is
unavailable, and own-ship should be removed promptly when position becomes
unavailable or insufficient. It also ties display scale to position accuracy.
Driftline adds a short, explicit transition from directional symbol to
non-directional accuracy state, then removes the symbol and retains a timestamped
`Last known position` inspection marker that cannot be mistaken for live
own-ship. Exact thresholds are application-state policy and require safety tests.

This initial product remains supplemental and non-certified; the guidance's
operator authorization and concurrent certified-display context must not be
misrepresented by an app-store disclaimer alone.

### Weather is strategic and time-bounded

FAA guidance describes graphical data-link weather as strategic/planning
information rather than a substitute for airborne weather radar and requires a
clear age indication. Driftline attaches observation/product time, retrieval
time, expiry policy, and animation-frame age to every weather view. Radar motion
cannot hide the timestamp and stale products stop animating as though current.

### Performance requires approved source data

FAA guidance grounds weight-and-balance and performance applications in
aircraft-specific approved manuals and validation across the operating envelope,
without extrapolation. The initial Driftline module therefore ships only generic,
fictional educational profiles. Importing authoritative profiles later requires
source identity, revision, envelope constraints, interpolation rules, full-domain
fixtures, and a distribution/licensing decision.

### Human factors are evaluated on the target device

FAA guidance emphasizes consistent data entry, colour, terminology and symbology,
clear unambiguous presentation, distraction control, direct-sunlight and night
legibility, and evaluation on the intended platform. Apple guidance adds adaptive
iPad multitasking, multiple input modes, Dynamic Type, VoiceOver, and sufficiently
sized controls. Driftline's release evidence must therefore include physical-
device daylight/night review, mounted viewing distance, coarse-touch tasks,
orientation and split-view matrices, and accessibility inspection.

## Original pilot workflow model

Driftline organizes pilot intent into a four-stage loop:

1. **Know** — confirm device, dataset, aircraft, source, and jurisdiction state.
2. **Plan** — build and validate a route and loading/weather scenario.
3. **Observe** — compare live or simulated evidence against the active plan.
4. **Recover** — make a reversible plan change or resolve a degraded source.

The loop is reflected in status and history rather than in competitor-specific
tabs, labels, gestures, or screen arrangements.

## Open research questions

- Which jurisdictions and operator categories define the first commercial scope?
- Which licensed data can legally support offline vector redistribution and
  derived spatial indexes?
- What external GNSS protocols and vendor agreements are viable on both iOS and
  Android?
- Which device/OS matrix is representative for sunlight, thermal, battery, and
  process-death testing?
- What independent pilot and human-factors review body will evaluate cockpit use?

## Primary references

- [FAA AC 120-76E PDF](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-76E_FAA_Web.pdf)
- [EASA Easy Access Rules for Air Operations, revision 24](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations)
- [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple: Designing for iPadOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados)

