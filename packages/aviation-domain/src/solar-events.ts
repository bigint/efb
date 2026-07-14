import type { Position } from '@driftline/geospatial';

export type SolarEvents =
  | {
      readonly accuracy: 'noaa-theoretical-one-minute' | 'noaa-theoretical-ten-minutes';
      readonly kind: 'available';
      readonly localCalendarDate: string;
      readonly sunriseUtc: string;
      readonly sunsetUtc: string;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: 'calculation-failed' | 'invalid-date' | 'polar-day' | 'polar-night';
    };

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const julianDay = (year: number, month: number, day: number): number => {
  const adjustedYear = month <= 2 ? year - 1 : year;
  const adjustedMonth = month <= 2 ? month + 12 : month;
  const century = Math.floor(adjustedYear / 100);
  const correction = 2 - century + Math.floor(century / 4);
  return (
    Math.floor(365.25 * (adjustedYear + 4_716)) +
    Math.floor(30.6001 * (adjustedMonth + 1)) +
    day +
    correction -
    1_524.5
  );
};

const julianCenturies = (julian: number): number => (julian - 2_451_545) / 36_525;
const julianFromCenturies = (centuries: number): number => centuries * 36_525 + 2_451_545;

const geometricMeanLongitude = (centuries: number): number =>
  (((280.46646 + centuries * (36_000.76983 + 0.0003032 * centuries)) % 360) + 360) % 360;
const geometricMeanAnomaly = (centuries: number): number =>
  357.52911 + centuries * (35_999.05029 - 0.0001537 * centuries);
const earthOrbitEccentricity = (centuries: number): number =>
  0.016708634 - centuries * (0.000042037 + 0.0000001267 * centuries);
const sunEquationOfCenter = (centuries: number): number => {
  const anomaly = toRadians(geometricMeanAnomaly(centuries));
  return (
    Math.sin(anomaly) * (1.914602 - centuries * (0.004817 + 0.000014 * centuries)) +
    Math.sin(2 * anomaly) * (0.019993 - 0.000101 * centuries) +
    Math.sin(3 * anomaly) * 0.000289
  );
};
const sunApparentLongitude = (centuries: number): number => {
  const trueLongitude = geometricMeanLongitude(centuries) + sunEquationOfCenter(centuries);
  const omega = 125.04 - 1_934.136 * centuries;
  return trueLongitude - 0.00569 - 0.00478 * Math.sin(toRadians(omega));
};
const obliquityCorrection = (centuries: number): number => {
  const seconds = 21.448 - centuries * (46.815 + centuries * (0.00059 - centuries * 0.001813));
  const meanObliquity = 23 + (26 + seconds / 60) / 60;
  const omega = 125.04 - 1_934.136 * centuries;
  return meanObliquity + 0.00256 * Math.cos(toRadians(omega));
};
const sunDeclination = (centuries: number): number =>
  toDegrees(
    Math.asin(
      Math.sin(toRadians(obliquityCorrection(centuries))) *
        Math.sin(toRadians(sunApparentLongitude(centuries))),
    ),
  );
const equationOfTime = (centuries: number): number => {
  const obliquity = obliquityCorrection(centuries);
  const longitude = geometricMeanLongitude(centuries);
  const eccentricity = earthOrbitEccentricity(centuries);
  const anomaly = geometricMeanAnomaly(centuries);
  const y = Math.tan(toRadians(obliquity) / 2) ** 2;
  const value =
    y * Math.sin(2 * toRadians(longitude)) -
    2 * eccentricity * Math.sin(toRadians(anomaly)) +
    4 * eccentricity * y * Math.sin(toRadians(anomaly)) * Math.cos(2 * toRadians(longitude)) -
    0.5 * y ** 2 * Math.sin(4 * toRadians(longitude)) -
    1.25 * eccentricity ** 2 * Math.sin(2 * toRadians(anomaly));
  return toDegrees(value) * 4;
};

const solarNoonUtcMinutes = (centuries: number, westLongitude: number): number => {
  const approximateNoon = julianCenturies(julianFromCenturies(centuries) + westLongitude / 360);
  let noon = 720 + westLongitude * 4 - equationOfTime(approximateNoon);
  const refined = julianCenturies(julianFromCenturies(centuries) - 0.5 + noon / 1_440);
  noon = 720 + westLongitude * 4 - equationOfTime(refined);
  return noon;
};

const hourAngleArgument = (latitude: number, declination: number): number => {
  const latitudeRadians = toRadians(latitude);
  const declinationRadians = toRadians(declination);
  return (
    Math.cos(toRadians(90.833)) / (Math.cos(latitudeRadians) * Math.cos(declinationRadians)) -
    Math.tan(latitudeRadians) * Math.tan(declinationRadians)
  );
};

const eventUtcMinutes = (
  julian: number,
  latitude: number,
  westLongitude: number,
  event: 'sunrise' | 'sunset',
): number | 'polar-day' | 'polar-night' => {
  const centuries = julianCenturies(julian);
  const noon = solarNoonUtcMinutes(centuries, westLongitude);
  const noonCenturies = julianCenturies(julian + noon / 1_440);
  let declination = sunDeclination(noonCenturies);
  let argument = hourAngleArgument(latitude, declination);
  if (argument > 1) return 'polar-night';
  if (argument < -1) return 'polar-day';
  let hourAngle = Math.acos(argument) * (event === 'sunrise' ? 1 : -1);
  const minutes =
    720 + 4 * (westLongitude - toDegrees(hourAngle)) - equationOfTime(noonCenturies);
  const refined = julianCenturies(julianFromCenturies(centuries) + minutes / 1_440);
  declination = sunDeclination(refined);
  argument = hourAngleArgument(latitude, declination);
  if (argument > 1) return 'polar-night';
  if (argument < -1) return 'polar-day';
  hourAngle = Math.acos(argument) * (event === 'sunrise' ? 1 : -1);
  return 720 + 4 * (westLongitude - toDegrees(hourAngle)) - equationOfTime(refined);
};

const parseCalendarDate = (
  value: string,
): {
  readonly day: number;
  readonly month: number;
  readonly utc: number;
  readonly year: number;
} | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  return year >= 2000 &&
    year <= 2099 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { day, month, utc, year }
    : null;
};

export const calculateSolarEvents = (
  location: Position,
  localCalendarDate: string,
): SolarEvents => {
  const date = parseCalendarDate(localCalendarDate);
  if (date === null) return { kind: 'unavailable', reason: 'invalid-date' };
  const julian = julianDay(date.year, date.month, date.day);
  const westLongitude = Number(location.longitude) * -1;
  const sunrise = eventUtcMinutes(julian, location.latitude, westLongitude, 'sunrise');
  if (typeof sunrise !== 'number') return { kind: 'unavailable', reason: sunrise };
  const sunset = eventUtcMinutes(julian, location.latitude, westLongitude, 'sunset');
  if (typeof sunset !== 'number') return { kind: 'unavailable', reason: sunset };
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
    return { kind: 'unavailable', reason: 'calculation-failed' };
  }
  return {
    accuracy:
      Math.abs(location.latitude) <= 72
        ? 'noaa-theoretical-one-minute'
        : 'noaa-theoretical-ten-minutes',
    kind: 'available',
    localCalendarDate,
    sunriseUtc: new Date(date.utc + Math.round(sunrise) * 60_000).toISOString(),
    sunsetUtc: new Date(date.utc + Math.round(sunset) * 60_000).toISOString(),
  };
};
