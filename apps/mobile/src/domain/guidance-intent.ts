export interface GuidanceIntent {
  readonly activeLegIndex: number | null;
  readonly directToIdentifier: string | null;
}

export const selectActiveLegIntent = (
  index: number | null,
  routeLength: number,
): GuidanceIntent => {
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
  if (identifier !== null && !availableIdentifiers.includes(identifier)) {
    throw new Error('Direct-to target is unavailable in the active dataset');
  }
  return { activeLegIndex: null, directToIdentifier: identifier };
};
