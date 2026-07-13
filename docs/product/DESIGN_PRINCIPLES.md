# Design principles

## Working visual direction

Driftline uses an original visual system based on **quiet structure and luminous
evidence**: deep neutral surfaces, restrained cyan for selection, amber for
attention, red reserved for immediate invalid/unsafe states, and textured or
shaped status marks so meaning never depends on colour alone. The brand motif is
an abstract wind-correction arc, not a wing, compass rose, or copied aviation
mark.

The name, mark, typography licence, and palette require trademark, legal, and
sunlight/night-cockpit evaluation before release.

## Cockpit legibility

- Design for glare, a mounted device, longer viewing distance, vibration, gloves,
  and one-handed use.
- Use tabular numerals for changing measurements and reserve condensed type for
  labels, never dense paragraphs.
- Default critical controls to 48-point minimum hit regions with generous gaps;
  destructive neighbours require additional separation.
- Offer coarse and precise interactions: drag plus move-before/move-after,
  pinch plus zoom buttons, scrub plus stepped timeline controls.
- Preserve essential map and status information at all Dynamic Type sizes; move
  secondary content rather than clipping values.

Apple recommends 44 by 44 points as the default iOS/iPadOS control size and
advises adequate spacing and simple gestures. Driftline's larger default is a
product safety margin, not a regulatory claim.

## Modes

- **Day:** high-luminance neutral canvas, dark text, subdued overlays, tested in
  direct sun.
- **Night:** low-luminance near-black surfaces, no pure white large areas,
  brightness-safe charts and overlays.
- **High contrast:** stronger borders and text contrast in both appearances,
  compatible with system Increase Contrast.
- **Simulation:** persistent violet/hatched frame and `SIMULATION` wording on
  every workspace; cannot be hidden by themes or overlays.

## Status semantics

| State | Shape and text | Colour role | Behaviour |
|---|---|---|---|
| Current/verified | solid dot + source | neutral/cyan | normal actions |
| Derived | diamond + `Calculated` | blue | formula details available |
| Stale | clock + age | amber | warning and refresh action |
| Unknown | hollow circle + `Unknown` | neutral | no invented fallback |
| Invalid | octagon + cause | red | dependent output blocked |
| Simulated | striped lozenge + `SIM` | violet | persistent global framing |

## Motion and feedback

Motion explains continuity and never signals safety alone. Respect Reduce
Motion; avoid blinking, elastic map effects, and long mode transitions. Critical
action feedback combines visible state change, text, and optional haptic feedback.

## Adaptive layouts

iPad supports touch, keyboard, pointer, Pencil where useful, multitasking, and
changing viewing distance. Layout tests cover portrait/landscape, full screen,
one-half, and narrow split widths. No workflow requires hover, a precise pointer,
or a multi-finger gesture.

## Originality guardrails

- Do not reproduce another product's screen hierarchy, wording, symbology,
  chart treatment, marketing claims, or interaction sequence.
- Use public standards only where standardized aviation meaning is required and
  document the source/licence.
- Maintain a design provenance log for fonts, icons, map styles, and imagery.
- Legal review precedes brand lock, public screenshots, or store submission.

## References

- [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple: Designing for iPadOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados)
- [Apple design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
- [W3C: WCAG 2.2 target size](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

