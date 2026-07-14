# Density-altitude estimate

## Scope

Driftline exposes a deliberately bounded density-altitude rule-of-thumb calculator beside a
decoded METAR. The user supplies field elevation; temperature and altimeter setting come from
the visibly identified current trusted real-source report. It is an educational planning
estimate, not approved aircraft performance data, and it does not determine take-off, landing,
climb, loading, or runway suitability.

## Formula and units

The implementation follows the approximation described by the FAA Safety Briefing article
[Density Altitude](https://www.faa.gov/sites/faa.gov/files/2022-01/JulAug2010.pdf):

1. Convert the decoded altimeter setting from hectopascals to inches of mercury.
2. Approximate pressure altitude in feet as field elevation plus
   `(29.92 - altimeter inHg) * 1,000`.
3. Approximate ISA temperature as `15 - 1.98 * pressure altitude thousands of feet`.
4. Estimate density altitude in feet as
   `pressure altitude + 120 * (outside-air temperature - ISA temperature)`.

Canonical inputs remain explicitly typed as hectopascals, feet, and Celsius. Display rounding
occurs only after calculation.

## Fail-closed boundary

The rule of thumb is accepted only for altimeter settings from 850–1,085 hPa, field elevations
from -1,500–15,000 ft, temperatures from -80–60 °C, and resulting pressure altitudes from
-2,000–18,000 ft. Results outside -5,000–30,000 ft are unavailable. These are application
guardrails, not operating limits.

The estimate excludes humidity, instrument error, local pressure variation, and
aircraft-specific effects. Pilots must use current official weather and the approved aircraft
flight manual or pilot operating handbook for performance decisions.
