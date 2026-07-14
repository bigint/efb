# Simulation runtime

## Scope

The current position source is an offline development simulator. It is not a GPS receiver and
must not be represented as live aircraft position. The application keeps the simulator visibly
identified with the purple `SIMULATION` frame and source label.

## Configurable profile

The System workspace accepts a bounded starting demonstration airport, altitude, groundspeed,
true track, vertical speed, and horizontal-accuracy value. Applying a profile clears the prior
sample and starts again at the chosen airport. The configuration persists in MMKV, but the live
sample never does. Existing version-four preferences migrate through the validated profile
default rather than being discarded.

Track is explicitly true: no magnetic variation is implied or applied. The profile does not
provide independent heading, attitude, sensor latency, or GNSS-error motion. Horizontal accuracy
is a displayed simulated quality value, not a randomized position-error model.

## Advancement rules

- The first sample establishes the scenario origin without movement.
- A subsequent tick advances along a great-circle destination by speed multiplied by elapsed
  time and adjusts altitude by vertical speed multiplied by the same bounded interval.
- Advancement is allowed only for finite elapsed intervals from zero through five seconds.
- A lifecycle gap longer than five seconds refreshes the sample timestamp at the same position;
  accumulated background time is never converted into a large jump.
- A clock reversal, non-finite time, invalid coordinate, invalid true track, missing configured
  origin, or altitude-envelope exit fails closed into a simulated GPS outage. Applying a valid
  profile or explicitly clearing the outage is required before samples resume.
- Longitude output is normalized by the shared geodesy implementation.

These rules bound each foreground update and make process suspension conservative. They do not
model turns, acceleration, randomized GNSS error, sensor latency, or real aircraft dynamics.

## Verification boundary

Pure tests cover exact one-second displacement and climb, long-gap pause behavior, clock
reversal, altitude-envelope exit, profile parsing, and invalid track input. The
JavaScript/Hermes production export passes. Native simulator, physical-device lifecycle, timer
throttling, and visual/accessibility validation remain open and are release blockers.
