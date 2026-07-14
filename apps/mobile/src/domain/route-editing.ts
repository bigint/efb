export const moveRouteWaypoint = (
  source: readonly string[],
  fromIndex: number,
  toIndex: number,
): readonly string[] => {
  if (source.length > 100) throw new RangeError('Route exceeds the supported waypoint limit');
  if (source.some((identifier) => !/^[A-Z0-9-]{1,16}$/u.test(identifier))) {
    throw new RangeError('Route contains an invalid waypoint identifier');
  }
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= source.length ||
    toIndex < 0 ||
    toIndex >= source.length
  ) {
    throw new RangeError('Route move index is outside the current route');
  }
  if (new Set(source).size !== source.length) {
    throw new Error('Route waypoints must be unique before reordering');
  }
  if (fromIndex === toIndex) return [...source];
  const moved = [...source];
  const [waypoint] = moved.splice(fromIndex, 1);
  if (waypoint === undefined) throw new Error('Route move lost its selected waypoint');
  moved.splice(toIndex, 0, waypoint);
  return moved;
};
