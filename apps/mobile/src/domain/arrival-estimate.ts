export type ArrivalEstimate =
  | { readonly isoUtc: string; readonly kind: 'ready' }
  | {
      readonly kind: 'unavailable';
      readonly reason:
        'duration-unavailable' | 'outside-supported-range' | 'system-clock-invalid';
    };

const MAX_ESTIMATE_MINUTES = 7 * 24 * 60;

export const estimateArrivalUtc = (
  nowMilliseconds: number,
  durationMinutes: number | null,
): ArrivalEstimate => {
  if (!Number.isFinite(nowMilliseconds) || nowMilliseconds < 0) {
    return { kind: 'unavailable', reason: 'system-clock-invalid' };
  }
  if (durationMinutes === null) {
    return { kind: 'unavailable', reason: 'duration-unavailable' };
  }
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 0 ||
    durationMinutes > MAX_ESTIMATE_MINUTES
  ) {
    return { kind: 'unavailable', reason: 'outside-supported-range' };
  }
  const arrival = new Date(nowMilliseconds + durationMinutes * 60_000);
  if (!Number.isFinite(arrival.getTime())) {
    return { kind: 'unavailable', reason: 'outside-supported-range' };
  }
  return { isoUtc: arrival.toISOString(), kind: 'ready' };
};
