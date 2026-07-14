# Navigation strip

## Explicit activation

The map does not infer an active leg from proximity. In Plan, the user explicitly activates one
resolved route leg by selecting its destination. The active index is transient session state: it
is not written to MMKV or a saved-flight record. Adding, removing, reversing, clearing, or
loading/replacing a route clears activation so derived values cannot silently transfer to new
route intent. A separate action clears activation without mutating the route.

## Derived values

Only a fresh validated position sample and an in-range active leg produce navigation values. The
framework-independent calculator returns:

- next waypoint identifier, great-circle distance, and initial true bearing from current
  position;
- signed spherical cross-track distance, with negative left and positive right of the selected
  leg;
- remaining distance as direct current-to-next distance plus every later route leg; and
- ETE to next and route end only when finite groundspeed is greater than zero.

The map strip currently displays groundspeed, altitude, reported course, next/distance, signed
cross-track side, and remaining distance/ETE. Platform course keeps the literal `PLATFORM`
reference; simulator course is true-referenced. Stale position, unresolved route data, no active
leg, and missing groundspeed render unavailable values rather than retained numbers.

The selected leg is also drawn as a thicker accent line above a subdued full-route line and is
named in the map evidence chip. This visual intent remains available when position is missing;
derived navigation values do not.

## Limitations

This is a navigation-dashboard subset, not a flight director or certified instrument. It has no
automatic waypoint sequencing, turn anticipation, magnetic course, heading source, pressure
altitude, vertical navigation, destination clock ETA, arrival detection, or route-deviation
alerting. Calculations use the documented spherical Earth model and fictional demonstration
waypoints. Native lifecycle, accessibility, visual, and independent-flight-fixture evidence are
open release blockers.
