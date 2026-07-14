import { parseAirport, type Airport } from './airport';

const sharedProvenance = {
  confidence: 'low',
  datasetVersion: 'demo-2026-07-14',
  effectiveAt: null,
  expiresAt: null,
  jurisdiction: 'DEMONSTRATION_ONLY',
  origin: 'simulated',
  retrievedAt: '2026-07-14T00:00:00.000Z',
  source: 'Driftline fictional demonstration fixture',
  sourceTimestamp: null,
  verificationStatus: 'unverified',
} as const;

// These are deliberately fictional and are not suitable for operational use.
const sources = [
  {
    elevationFeet: 2874,
    iata: null,
    icao: 'DVL1',
    name: 'Drift Valley Demonstration Field',
    position: { latitude: 12.9716, longitude: 77.5946 },
    provenance: sharedProvenance,
    runways: [
      {
        designator: '09/27',
        headingTrueDegrees: 92,
        lengthMetres: 1800,
        surface: 'Asphalt (fictional)',
        widthMetres: 30,
      },
    ],
    timezone: 'Asia/Kolkata',
  },
  {
    elevationFeet: 112,
    iata: null,
    icao: 'DVL2',
    name: 'Luminous Coast Demonstration Airport',
    position: { latitude: 13.0827, longitude: 80.2707 },
    provenance: sharedProvenance,
    runways: [
      {
        designator: '04/22',
        headingTrueDegrees: 44,
        lengthMetres: 1525,
        surface: 'Asphalt (fictional)',
        widthMetres: 30,
      },
    ],
    timezone: 'Asia/Kolkata',
  },
  {
    elevationFeet: 1760,
    iata: null,
    icao: 'DVL3',
    name: 'Western Ridge Demonstration Strip',
    position: { latitude: 15.3173, longitude: 75.7139 },
    provenance: sharedProvenance,
    runways: [
      {
        designator: '16/34',
        headingTrueDegrees: 162,
        lengthMetres: 1210,
        surface: 'Paved (fictional)',
        widthMetres: 23,
      },
    ],
    timezone: 'Asia/Kolkata',
  },
] as const;

export const demoAirports: readonly Airport[] = sources.map(parseAirport);
