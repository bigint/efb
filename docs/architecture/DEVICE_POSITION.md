# Device position

## Scope

Driftline can subscribe to the operating system's foreground location stream after an explicit
user action. It requests only foreground permission; no background location permission, task, or
service is configured. The feature is supplemental position awareness and is not approved as a
primary navigation instrument.

## Source lifecycle

Position source selection is atomic: disabled, simulated, or device. Device state is explicit as
checking, permission required, permission denied, service disabled, watching, or error. Source
changes clear the prior sample, so simulated and device telemetry cannot be combined.

On selection, the controller checks foreground permission and whether system location services
are enabled before starting a best-for-navigation foreground subscription. The subscription is
owned above individual workspaces and is removed when the source changes or the application
shell unmounts. Provider errors clear all live telemetry and require a source restart.

The existing persisted preference key is retained. Persistence v3 stores only device intent in
the `checking` state; it never restores a prior `watching` assertion. Older v2 route and
workspace state passes through the validated merge boundary.

## Telemetry boundary

Platform coordinates and timestamps must be finite and in range. Metres per second and metres
are converted to knots and feet at one pure boundary. Missing accuracy, altitude, speed, or
course remains `null` and renders as unavailable; the adapter never invents zero values.
Negative altitudes remain valid within a conservative bound. Native negative speed sentinels
become missing telemetry; out-of-range values that reach the pure boundary, invalid course, or
malformed coordinates fail closed.

The platform course is labelled with reference `platform`, because the current integration does
not independently establish a true or magnetic reference. The simulator remains explicitly
true-referenced. Samples older than three seconds disappear from the map and status strip.

## Visual framing

Simulation retains the purple app frame and purple ownship. Device position uses the normal
accent colour and `DEVICE POSITION` / `foreground location` labels. Unknown accuracy is stated
instead of formatted as a numeric radius. A position-source failure removes groundspeed,
altitude, and ownship values.

Airport details derive a read-only great-circle distance and initial true bearing only while the
same three-second position evaluation is available. The panel shows simulated/device source,
sample age, and horizontal accuracy at point of use. It disappears into an explicit unavailable
reason when the source is stale or failed. This is a relative information readout, not route
sequencing or a direct-to command.

## Verification boundary

Pure tests cover unit conversion, nullable provider values, device status mapping, freshness,
invalid samples, and persistence recovery. Expo Doctor and the production JavaScript/Hermes
export validate configuration and bundling only. Native permission prompts, denied/restricted
states, foreground/background transitions, provider loss, energy use, accuracy behavior, and
physical-device visual/accessibility behavior remain open release blockers.
