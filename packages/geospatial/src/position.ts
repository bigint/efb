import { degrees, type Degrees } from '@driftline/data-contracts';

export interface Position {
  readonly latitude: Degrees;
  readonly longitude: Degrees;
}

export const position = (latitude: number, longitude: number): Position => {
  if (latitude < -90 || latitude > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees');
  }
  if (longitude < -180 || longitude > 180) {
    throw new RangeError('Longitude must be between -180 and 180 degrees');
  }
  return { latitude: degrees(latitude), longitude: degrees(longitude) };
};
