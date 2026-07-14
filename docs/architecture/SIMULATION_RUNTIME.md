# Simulation runtime

## Scope

The current position source is an offline development simulator. It is not a GPS receiver and
must not be represented as live aircraft position. The application keeps the simulator visibly
identified with the purple `SIMULATION` frame and source label.

## Constant profile

The development profile advances at 118 knots on a 068-degree true track at 4,500 feet. The
track reference is explicit: no magnetic variation is implied or applied. The profile carries a
50-metre simulated horizontal-accuracy value.

## Advancement rules

- The first sample establishes the scenario origin without movement.
- A subsequent tick advances along a great-circle destination by speed multiplied by elapsed
  time.
- Advancement is allowed only for finite elapsed intervals from zero through five seconds.
- A lifecycle gap longer than five seconds refreshes the sample timestamp at the same position;
  accumulated background time is never converted into a large jump.
- A clock reversal, non-finite time, invalid coordinate, or invalid true track fails closed and
  clears the active scenario through the store recovery boundary.
- Longitude output is normalized by the shared geodesy implementation.

These rules bound each foreground update and make process suspension conservative. They do not
model turns, acceleration, climb, descent, GNSS error, sensor latency, or real aircraft
dynamics.

## Verification boundary

Pure tests cover exact one-second displacement, long-gap pause behavior, clock reversal, and
invalid track input. The JavaScript/Hermes production export passes. Native simulator,
physical-device lifecycle, timer throttling, and visual/accessibility validation remain open and
are release blockers.
