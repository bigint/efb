# Jurisdiction matrix

Status: Phase 0 regulatory routing map, not legal advice
Initial comparison: ICAO baseline, United States, EASA States, United Kingdom, and India

## 1. How to use this matrix

This document identifies where behaviour must be jurisdiction-specific. It deliberately avoids copying detailed operational minima into product requirements before an aviation/regulatory review. The controlling source is always the current regulation, AIP, NOTAM, approved aircraft document, operator manual, and ATC clearance applicable to the flight.

ICAO Standards and Recommended Practices create an international baseline, but States publish differences and local procedures. A product must not interpret “ICAO compliant” as “identical everywhere.” ICAO itself describes the State AIP and its amendments/supplements as primary AIS products ([ICAO AIM](https://www.icao.int/airnavigation/aeronautical-information-management)).

Legend:

- **Implement**: suitable candidate for a reviewed rule pack.
- **Inform/link**: display source material and context; do not calculate legality.
- **Blocked**: requires authoritative data, legal rights, or regulator/operator approval first.

## 2. Authority and source map

| Region | Primary aviation authority / AIS | Weather authority path | EFB approval anchor | Product posture |
| --- | --- | --- | --- | --- |
| ICAO baseline | ICAO Annexes, PANS, and State AIS implementations; ICAO publications are generally copyrighted/purchased | ICAO Annex 3/WMO framework; actual data supplied by States and designated providers | ICAO Doc 10020 plus State implementation | Inform/link; use as taxonomy, never as a substitute for local law. |
| United States | FAA regulations, U.S. AIP, AIM, NASR, charts, NOTAM services | NOAA/NWS and FAA Aviation Weather Center | Active [FAA AC 120-76E](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1042829) for Parts 91K/121/125/135; Part 91 context differs | Best candidate for an official/open-data pilot, subject to product-specific terms and validation. |
| EASA Member States | EU Air Operations rules plus each State CAA/AIS/AIP; EAD aggregates contracted data | State MET providers, EUMETNET/WMO arrangements, and commercial services | [EASA ED Decision 2019/008/R](https://www.easa.europa.eu/en/document-library/agency-decisions/ed-decision-2019008r), Air Ops rules, and [AMC 20-25A](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-acceptable-means-2?page=19) | Contract and State-by-State review required. EAD machine access requires an agreement. |
| United Kingdom | UK CAA rules and NATS AIS/AIP after EU exit | UK Met Office / designated aviation MET channels | [UK CAA EFB guidance](https://www.caa.co.uk/commercial-industry/aircraft/airworthiness/aircraft-equipment/electronic-flight-bags/) and operator approval | Treat as its own jurisdiction; do not assume current EASA rules automatically govern. NATS content rights require verification. |
| India | DGCA regulations/CARs; AAI AIS/eAIP and International NOTAM Offices | India Meteorological Department and AAI briefing channels | DGCA CAR Section 8 Series S Part VIII and CAP 8600; the Ministry records their issue in 2022 ([February summary](https://www.civilaviation.gov.in/sites/default/files/migration/monthly-summary-feb-2022.pdf), [March summary](https://www.civilaviation.gov.in/sites/default/files/migration/monthly-summary-march-2022.pdf)) | High product relevance, but machine access and redistribution rights remain unverified; informational prototype only until permission. |

## 3. Behaviour matrix

| Topic | ICAO baseline | United States | EASA States | United Kingdom | India | Required implementation gate |
| --- | --- | --- | --- | --- | --- | --- |
| Aeronautical information cycle | Significant planned changes use common 28-day AIRAC dates ([ICAO AIRAC](https://www.icao.int/airnavigation/airac)). | NASR static data is published on a 28-day cycle; some chart products are 28 or 56 days ([FAA NASR](https://www.faa.gov/air_traffic/flight_info/aeronav/Aero_Data/NASR_Subscription/), [FAA editions](https://www.faa.gov/air_traffic/flight_info/aeronav/productcatalog/doles/)). | State AIPs/EAD use AIRAC, with non-AIRAC and temporary changes also possible. | NATS eAIP editions identify publication and effective dates; current example warns users to consult NOTAM ([NATS eAIP cover](https://www.aurora.nats.co.uk/htmlAIP/Publications/2026-05-14-AIRAC/html/EG-cover-en-GB.html)). | AAI says each AIRAC amendment updates the eAIP and does not replace the current AIP until effective ([AAI GEN 3.1](https://aim-india.aai.aero/eaip/eaip-v2-01-2026/eAIP/IN-GEN%203.1-en-GB.html)). | Implement cycle-aware activation, overlapping current/next datasets, non-AIRAC deltas, and rollback. |
| Airspace class semantics | Annex 11 classes provide a baseline, but States choose and supplement them. | FAA classes and special-use constructs use U.S. regulations/AIM/AIP; national constructs such as TFRs need separate modelling. | EU rules plus national AIP and flexible-use/temporary structures. | UK rules/AIP, including UK-specific structures and services. | AAI AIP ENR and DGCA rules; local defence/clearance constraints require explicit source review. | Rule pack keyed by State/FIR, time, level, flight rules, aircraft/equipment, and operation. Never infer clearance from a map colour. |
| VFR/IFR minima and equipment | Baseline exists in ICAO Annexes; full text is controlled/copyrighted. | 14 CFR and FAA publications. | SERA/Air Ops plus State differences. | UK retained/amended rules and CAA publications. | Aircraft Rules, DGCA CARs, AAI AIP differences. | Inform/link at first. Implement only with counsel-reviewed, versioned rules and boundary fixtures. |
| Altimeter setting, transition altitude/level, and cruising levels | ICAO baseline; local values published by States. | U.S. rules/AIP; units and standard setting conventions differ from some regions. | State-published transition values and regional rules. | UK AIP and rules. | AAI AIP GEN/ENR and local ATC procedures. | Store QNH/QFE/standard separately, preserve source units, and select logic by location/time. No global transition-altitude constant. |
| Units | ICAO permits an aviation-specific combination of units. | Feet, NM, knots, statute miles/visibility and inches Hg may appear by context. | Feet/FL, NM/knots, metres and hPa appear by context/State. | UK-specific chart/AIP conventions. | AAI publishes measuring systems and conversion information in AIP GEN 2. | Field-level unit metadata and jurisdiction-specific display/entry defaults; never rely on locale alone. |
| Route availability and airway use | ATS routes and restrictions are State-published and time-dependent. | NASR plus FAA route advisories, procedures, NOTAMs, and ATC. | State AIP/EAD plus conditional route/flexible-use systems. | NATS AIP and tactical restrictions. | AAI AIP, NOTAM, flow/defence processes. | Route expansion can show published topology; legality/acceptance remains unresolved unless all constraints are sourced. |
| Instrument procedures | ICAO PANS-OPS baseline; coding/distribution rights separate. | FAA d-TPP/charts and licensed procedure coding as needed. | State procedures via AIS/EAD or licensed ARINC supplier. | NATS charts/data under applicable terms. | AAI eAIP charts; no verified redistribution right. | Block structured operational guidance until a licensed, quality-controlled feed and coding validation exist. Chart viewing must enforce edition/rights. |
| NOTAM | State NOFs originate and exchange NOTAM; text and schedules can be difficult to normalize. | FAA official NOTAM channels; the public WFS page describes a **demo**, so it is not a production SLA ([FAA NOTAM WFS](https://notams.aim.faa.gov/notamWFS/)). | EAD INO is available to contracted MyEAD users. | NATS/UK AIS briefing channels. | AAI lists NOF offices and PIB/NOTAM as AIS products ([AAI GEN 3.1](https://aim-india.aai.aero/eaip/eaip-v2-01-2026/eAIP/IN-GEN%203.1-en-GB.html)). | Contract a production feed, preserve raw text, model cancellation/replacement and schedules, show retrieval coverage and failures. |
| Weather and official briefing | ICAO/WMO define products; designated State providers supply them. | AWC API provides METAR, TAF, PIREP, SIGMET and other products with explicit rate limits ([AWC API](https://aviationweather.gov/data/api/)). Whether a workflow is an official briefing is a separate legal/operational question. | Provider and operator arrangements vary; third-party/lightning/radar rights may differ. | Met Office and approved briefing/provider arrangements. | IMD/AAI channels; public machine-feed and reuse rights unverified. | Separate weather depiction from official briefing status. Show issue/valid/retrieval/stale times and provider identity. |
| Portable EFB hardware | State/operator implementation of ICAO guidance. | AC 120-76E describes equivalent accessibility, usability, and reliability for covered operators; mounting, power, interference, and backup enter the operator program. | Air Ops rules and AMC distinguish portable/installed hardware and application classes. | CAA states portable devices used in all phases must be secured appropriately and operator approval does not verify the database itself ([CAA EFB](https://www.caa.co.uk/commercial-industry/aircraft/airworthiness/aircraft-equipment/electronic-flight-bags/)). | Specific approval regime exists for operators; exact applicability to each operation must be checked in current CAR/CAP. | Product claim remains “unapproved supplemental aid.” Commercial operator adoption needs an operator-specific approval package. |
| Own-ship on charts/maps | Approval and intended function matter. | Depends on operation, application class/function, data, hardware, and authorization. | Type/application classification and operator approval matter. | CAA/operator approval and intended function matter. | DGCA approval regime must be reviewed. | Permit only on explicitly georeferenced layers, label GPS accuracy/integrity, prevent use on unreferenced diagrams, and never claim primary navigation. |
| Terrain/obstacle alerting | Data areas and quality concepts exist in ICAO material; warning-system approval is separate. | FAA DOF has explicit scope limitations; certified TAWS is a different system. | State/EAD/contracted datasets and certification rules. | UK AIS/licensed sources and CAA rules. | AAI AIP obstacle data; digital feed/rights unknown. | Initial release may depict and provide conservative advisory awareness only. Avoid TAWS/HTAWS terminology and certified-style claims. |
| Takeoff/landing and W&B | Approved aircraft data and operator/regulator policy control. | AFM/POH, supplements, regulations, and operator rules. | AFM plus EASA/operator rules and approvals. | CAA/operator rules and approved aircraft data. | DGCA/operator rules and approved aircraft data. | No aircraft-specific result without sourced tables, interpolation validation, revision control, and prohibited-extrapolation handling. Generic model must be labelled educational. |
| Fuel reserves and alternate rules | ICAO baseline depends on operation category. | 14 CFR/operator rules vary by operation and flight rules. | Air Ops/SERA/operator rules vary by category. | UK rules/operator requirements. | DGCA CARs/rules and operator procedures. | No universal reserve default. Require an explicit reviewed policy and show each reserve component. |
| Fuel availability | AIP AD information is directory data and can change. | FAA Chart Supplement includes airport services, but availability still requires confirmation. | State AIP/operator directories. | NATS AIP/operator sources. | AAI eAIP AD sections may publish fuel/service information. | Show source/age/contact and “confirm with provider”; do not promise stock, price, hours, or aircraft compatibility. |
| Filing and clearance | ICAO flight-plan format and ATS messaging are implemented locally. | FAA filing providers and ATC systems. | Network Manager/State arrangements. | UK filing/ATS arrangements. | AAI/DGCA/defence and local ATS processes. | Initial route is a draft only. Filing integration requires provider contracts, identity/security, acknowledgements, and status reconciliation. |
| Privacy/location retention | State privacy and aviation-record rules apply. | U.S. federal/state and provider terms. | GDPR plus national law. | UK GDPR/Data Protection Act. | Digital Personal Data Protection Act and sector obligations. | Data protection impact assessment, opt-in telemetry, retention controls, deletion/export, and separation of safety audit records from analytics. |

## 4. Product modes and jurisdiction status

| Mode | Allowed capability | Jurisdiction requirement |
| --- | --- | --- |
| Simulation | Synthetic position, route planning, generic performance, and clearly marked non-current/community data | Must be visually unmistakable; never intermingle simulated and live state. |
| Education | Explain concepts and show examples | Examples identify jurisdiction and effective date; do not present them as universal rules. |
| Pre-flight planning | Current charts/data/weather/NOTAM assistance | Requires lawful current feeds, coverage disclosure, and a clear distinction from an official briefing or filing. |
| Supplemental in-flight awareness | GPS map, route progress, weather age, airport information | Requires reliable offline data, explicit limitations, mounting/power planning, and no primary-navigation claim. |
| Operator-approved EFB | Replacement of required paper or operational Type B functions | Blocked until the operator and authority approve hardware, software, data, procedures, training, human factors, administration, backup, and change control. |
| Installed/certified function | Integration with aircraft systems or certified navigation/safety function | Out of initial scope; requires airworthiness/certification programme and approved installation. |

## 5. Required rule-pack metadata

Each jurisdiction implementation must declare:

- controlling authority and primary source links;
- effective and review dates, applicable operation and aircraft categories;
- known State differences and unresolved questions;
- data provider and licence/redistribution status;
- test fixtures at geographic, temporal, altitude, and equality boundaries;
- aviation reviewer and legal reviewer;
- safe behaviour when the rule or source is missing, stale, conflicting, or outside coverage;
- whether the implementation is informational, advisory, filing-capable, operator-approved, or certified.

## 6. Phase 0 decisions and unknowns

### Verified

- AIRAC uses internationally coordinated 28-day effective dates for significant changes.
- FAA NASR provides a current/preview/archive cycle structure and structured static data suitable for evaluating a U.S. adapter.
- MyEAD system-to-system access requires an EAD Data User Agreement and can carry service/royalty charges ([EUROCONTROL MyEAD](https://www.ead.eurocontrol.int/cms-eadbasic/opencms/en/ead-solutions/my-ead/)).
- India publishes an English eAIP and identifies AAI as AIS provider for Indian territory and assigned oceanic areas.
- FAA, EASA, UK CAA, and DGCA all have EFB-specific operational/airworthiness regimes for at least some operators and functions.

### Unknown or requiring counsel/authority confirmation

- Commercial redistribution rights for AAI eAIP data/charts and NATS eAIP content.
- A production-grade public NOTAM API/SLA for the U.S. and India.
- Which weather-provider workflow can legally be described as an official briefing in each launch jurisdiction.
- Whether ODbL taxiway data can be combined and redistributed in the planned offline database without affecting proprietary/authoritative datasets.
- Exact DGCA applicability and approval path for a privately used, non-certified planning app versus an operator EFB.

## 7. Recommendation

Start implementation with a U.S.-only, supplemental-use profile backed by FAA/NOAA sources and a strict source/licence registry. In parallel, request written commercial-use and redistribution terms from AAI, NATS, and EUROCONTROL rather than deriving permission from public web access. Keep India and European interfaces visible in the architecture, but feature-gated until data and regulatory gates close.
