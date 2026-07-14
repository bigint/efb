# Wind-triangle implementation boundary

The framework-independent flight-planning package solves a planar wind triangle for a desired
true ground track, true airspeed, and wind reported as the true direction it is coming from. The
result carries true heading, signed wind-correction angle, and groundspeed, or an explicit
no-solution reason when crosswind exceeds airspeed or forward progress is impossible.

The aviation concepts follow the FAA description of wind drift and wind-correction angle in the
[Pilot's Handbook of Aeronautical Knowledge](https://www.faa.gov/aviation/phak/pilots-handbook-aeronautical-knowledge-faa-h-8083-25b).
The true-north contract is consistent with the FAA explanation that PBN systems navigate by true
north and apply magnetic variation for display in the
[Aeronautical Information Manual](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html).

This is a planning calculation, not guidance or a certified performance result. It does not
interpolate winds aloft, model climb/descent, account for changing wind along a geodesic, or
perform magnetic conversion. Those inputs remain unavailable until their source, altitude, valid
time, model, and uncertainty are explicit.
