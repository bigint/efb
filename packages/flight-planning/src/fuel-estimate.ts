export type CruiseFuelEstimate =
  | {
      readonly kind: 'ready';
      readonly requiredLitres: number;
      readonly usableFuelLitres: number;
      readonly withinEnteredUsableFuel: boolean;
    }
  | { readonly kind: 'unavailable'; readonly reason: 'invalid-input' | 'missing-aircraft' };

export const calculateCruiseFuelEstimate = ({
  estimatedMinutes,
  fuelBurnLitresPerHour,
  usableFuelLitres,
}: {
  readonly estimatedMinutes: number | null;
  readonly fuelBurnLitresPerHour: number | null;
  readonly usableFuelLitres: number | null;
}): CruiseFuelEstimate => {
  if (fuelBurnLitresPerHour === null || usableFuelLitres === null) {
    return { kind: 'unavailable', reason: 'missing-aircraft' };
  }
  if (
    estimatedMinutes === null ||
    !Number.isFinite(estimatedMinutes) ||
    estimatedMinutes < 0 ||
    estimatedMinutes > 7 * 24 * 60 ||
    !Number.isFinite(fuelBurnLitresPerHour) ||
    fuelBurnLitresPerHour < 0 ||
    fuelBurnLitresPerHour > 10_000 ||
    !Number.isFinite(usableFuelLitres) ||
    usableFuelLitres < 0 ||
    usableFuelLitres > 100_000
  ) {
    return { kind: 'unavailable', reason: 'invalid-input' };
  }
  const requiredLitres = (estimatedMinutes / 60) * fuelBurnLitresPerHour;
  return {
    kind: 'ready',
    requiredLitres,
    usableFuelLitres,
    withinEnteredUsableFuel: requiredLitres <= usableFuelLitres,
  };
};
