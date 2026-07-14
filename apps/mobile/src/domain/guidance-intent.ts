export interface GuidanceIntent {
  readonly activeLegIndex: number | null;
  readonly directToIdentifier: string | null;
}

const MAXIMUM_ROUTE_WAYPOINTS = 100;
const MAXIMUM_AVAILABLE_WAYPOINTS = 10_000;
const validIdentifier = (value: string): boolean => /^[A-Z0-9-]{1,16}$/u.test(value);

export const selectActiveLegIntent = (
  index: number | null,
  routeLength: number,
): GuidanceIntent => {
  if (
    !Number.isSafeInteger(routeLength) ||
    routeLength < 0 ||
    routeLength > MAXIMUM_ROUTE_WAYPOINTS
  ) {
    throw new RangeError('Route length is outside the supported range');
  }
  if (index === null) return { activeLegIndex: null, directToIdentifier: null };
  if (!Number.isInteger(index) || index < 0 || index >= routeLength - 1) {
    throw new RangeError('Active leg index is outside the current route');
  }
  return { activeLegIndex: index, directToIdentifier: null };
};

export const selectDirectToIntent = (
  identifier: string | null,
  availableIdentifiers: readonly string[],
): GuidanceIntent => {
  if (availableIdentifiers.length > MAXIMUM_AVAILABLE_WAYPOINTS) {
    throw new RangeError('Available direct-to targets exceed the supported limit');
  }
  const available = new Set<string>();
  for (const candidate of availableIdentifiers) {
    if (!validIdentifier(candidate) || available.has(candidate)) {
      throw new RangeError('Available direct-to targets are invalid or ambiguous');
    }
    available.add(candidate);
  }
  if (identifier !== null && !validIdentifier(identifier)) {
    throw new RangeError('Direct-to target identifier is invalid');
  }
  if (identifier !== null && !available.has(identifier)) {
    throw new Error('Direct-to target is unavailable in the active dataset');
  }
  return { activeLegIndex: null, directToIdentifier: identifier };
};
