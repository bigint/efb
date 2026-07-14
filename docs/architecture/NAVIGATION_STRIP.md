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
cross-track side, remaining distance/ETE, explicit position-source health, and device battery
state. Source health includes simulated/device identity, sample age, and horizontal accuracy; an
unavailable source shows its failure reason instead of retained telemetry. Platform course keeps
the literal `PLATFORM` reference; simulator course is true-referenced. Stale position,
unresolved route data, no active leg, and missing groundspeed render unavailable values rather
than retained numbers.

Battery level, charging state, and system low-power state come from the foreground Expo Battery
adapter. The boundary accepts only a finite level from 0 through 100 percent and a known native
state. Unsupported devices, simulators, provider sentinels, invalid telemetry, and adapter
errors render `UNAVAILABLE`; they never become a zero-percent warning. Native change listeners
are removed when the map unmounts. Battery telemetry is advisory and does not estimate
endurance.

The selected leg is also drawn as a thicker accent line above a subdued full-route line and is
named in the map evidence chip. This visual intent remains available when position is missing;
derived navigation values do not.

## Map orientation

The map starts north-up and exposes one cockpit-sized control to request track-up. A track-up
camera requires the same fresh validated position plus a finite reported course. It centres the
ownship and rotates to that course, while retaining the literal `true` or `platform` reference
in the control label. If position or course becomes unavailable, the requested mode remains
visible but the camera returns to north with `TRACK UP UNAVAILABLE · NORTH FALLBACK`; it does
not hold a stale rotation. Returning to north-up removes automatic centring.

## Limitations

This is a navigation-dashboard subset, not a flight director or certified instrument. Track-up
uses reported course, never an inferred heading. It has no automatic waypoint sequencing, turn
anticipation, magnetic course, heading source, pressure altitude, vertical navigation,
destination clock ETA, arrival detection, or route-deviation alerting. Calculations use the
documented spherical Earth model and fictional demonstration waypoints. Native battery/event
behavior, lifecycle, accessibility, visual, energy, and independent-flight-fixture evidence are
open release blockers.
