# Airport dossier

The Places workspace reads normalized airports from the active aviation-domain collection. It
shows identifier, coordinates, elevation, IANA timezone, runway geometry, source, dataset
version, retrieval/effective/expiry metadata, verification, confidence, and currency. Runway
heading is explicitly true-referenced.

Nearby airports are a pure deterministic great-circle ranking over unique active candidates. The
origin is excluded, results are distance/identifier sorted, and callers must choose a limit from
1 through 50. The current demonstration collection requests at most five.

The fictional dataset does not contain frequencies, services, fuel, operating notes, NOTAM, or
sunrise/sunset inputs. The dossier states `NOT SUPPLIED`, `NOT AVAILABLE`, or `NOT CALCULATED`
for each field and warns that absence does not establish operational availability or safety. No
placeholder values or current-data implication are generated.

Authoritative ingestion, runway declared distances, weather linkage, timezone-aware solar
calculation, favourite-only filtering, dataset-scale spatial indexing, native adaptive layout,
and accessibility evidence remain open.
