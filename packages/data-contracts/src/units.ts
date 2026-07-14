declare const unitBrand: unique symbol;

export type BrandedUnit<Name extends string> = number & { readonly [unitBrand]: Name };

export type Celsius = BrandedUnit<'celsius'>;
export type Degrees = BrandedUnit<'degrees'>;
export type Feet = BrandedUnit<'feet'>;
export type Hectopascals = BrandedUnit<'hectopascals'>;
export type Kilograms = BrandedUnit<'kilograms'>;
export type Knots = BrandedUnit<'knots'>;
export type MagneticDegrees = BrandedUnit<'magnetic-degrees'>;
export type Metres = BrandedUnit<'metres'>;
export type NauticalMiles = BrandedUnit<'nautical-miles'>;
export type Radians = BrandedUnit<'radians'>;
export type TrueDegrees = BrandedUnit<'true-degrees'>;

const requireFinite = (value: number, unit: string): number => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${unit} must be finite`);
  }
  return value;
};

export const degrees = (value: number): Degrees => requireFinite(value, 'Degrees') as Degrees;
export const celsius = (value: number): Celsius => requireFinite(value, 'Celsius') as Celsius;
export const feet = (value: number): Feet => requireFinite(value, 'Feet') as Feet;
export const hectopascals = (value: number): Hectopascals =>
  requireFinite(value, 'Hectopascals') as Hectopascals;
export const kilograms = (value: number): Kilograms =>
  requireFinite(value, 'Kilograms') as Kilograms;
export const knots = (value: number): Knots => requireFinite(value, 'Knots') as Knots;
const requireBearing = (value: number, reference: string): number => {
  requireFinite(value, reference);
  if (value < 0 || value >= 360) throw new RangeError(`${reference} must be in [0, 360)`);
  return value;
};
export const magneticDegrees = (value: number): MagneticDegrees =>
  requireBearing(value, 'Magnetic degrees') as MagneticDegrees;
export const metres = (value: number): Metres => requireFinite(value, 'Metres') as Metres;
export const nauticalMiles = (value: number): NauticalMiles =>
  requireFinite(value, 'Nautical miles') as NauticalMiles;
export const radians = (value: number): Radians => requireFinite(value, 'Radians') as Radians;
export const trueDegrees = (value: number): TrueDegrees =>
  requireBearing(value, 'True degrees') as TrueDegrees;

export const toRadians = (value: Degrees | MagneticDegrees | TrueDegrees): Radians =>
  radians((value * Math.PI) / 180);
export const toDegrees = (value: Radians): Degrees => degrees((value * 180) / Math.PI);
export const metresToNauticalMiles = (value: Metres): NauticalMiles =>
  nauticalMiles(value / 1852);
export const nauticalMilesToMetres = (value: NauticalMiles): Metres => metres(value * 1852);

export const normaliseDegrees = (value: Degrees): Degrees =>
  degrees(((value % 360) + 360) % 360);
