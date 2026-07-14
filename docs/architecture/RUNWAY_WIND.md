# Runway wind display

The Places runway-wind panel is a transient vector calculator, not a weather source or runway
recommendation. It accepts an explicit meteorological wind-from direction from 0 through 359°T,
a steady speed from 0 through 300 KT, and an optional gust speed in the same range. Gust must be
at least steady speed. Missing, non-finite, and out-of-range input renders the result
unavailable.

Only runways with a supplied true heading participate. The published fixture heading is treated
as the first named end and its reciprocal is exactly heading plus 180°, normalized into
`[0, 360)`. For each end, relative wind angle is `wind-from true - runway true`; longitudinal
component is `speed × cos(angle)` and signed cross component is `speed × sin(angle)`. Positive
longitudinal is labelled headwind, negative is tailwind. Positive cross component is wind from
the right, negative from the left. Near-zero floating-point residuals are displayed as `NONE`
and zero.

Steady and gust calculations remain separate and show one decimal knot. Input persists only
while the mounted workspace remains alive. The panel does not fetch or bind METAR, convert
magnetic direction, apply runway/aircraft limits, choose a runway, account for variability, or
infer an operational decision. All current runways and weather input are fictional or
user-entered; native keyboard, visual, accessibility, and cockpit-use evidence remain open.
