import { position, type Position } from '@driftline/geospatial';

export const ROUTE_GPX_WAYPOINT_LIMIT = 100;

export interface RouteGpxWaypoint {
  readonly identifier: string;
  readonly position: Position;
}

const assertXmlText = (value: string, label: string): void => {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint === undefined ||
      (codePoint !== 0x09 &&
        codePoint !== 0x0a &&
        codePoint !== 0x0d &&
        (codePoint < 0x20 ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
          codePoint === 0xfffe ||
          codePoint === 0xffff))
    ) {
      throw new Error(`${label} contains a character that XML 1.0 cannot represent.`);
    }
  }
};

const xmlText = (value: string): string => {
  assertXmlText(value, 'Waypoint identifier');
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
};

export const createRouteGpx = (source: readonly RouteGpxWaypoint[]): string => {
  if (source.length < 2) throw new RangeError('A GPX route requires at least two waypoints.');
  if (source.length > ROUTE_GPX_WAYPOINT_LIMIT) {
    throw new RangeError(`GPX export supports at most ${ROUTE_GPX_WAYPOINT_LIMIT} waypoints.`);
  }

  const identifiers = new Set<string>();
  const points = source.map((waypoint) => {
    const identifier = waypoint.identifier.trim();
    if (identifier.length === 0 || identifier.length > 32) {
      throw new RangeError('Waypoint identifiers must contain 1 through 32 characters.');
    }
    if (identifiers.has(identifier)) {
      throw new Error('GPX route contains duplicate waypoint identifiers.');
    }
    identifiers.add(identifier);
    const validated = position(waypoint.position.latitude, waypoint.position.longitude);
    return `    <rtept lat="${validated.latitude.toFixed(7)}" lon="${validated.longitude.toFixed(7)}"><name>${xmlText(identifier)}</name></rtept>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Driftline" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    '    <name>Driftline unverified route snapshot</name>',
    '    <desc>FICTIONAL AND UNVERIFIED. NOT AUTHORITATIVE NAVIGATION DATA.</desc>',
    '  </metadata>',
    '  <rte>',
    '    <name>Driftline unverified route</name>',
    ...points,
    '  </rte>',
    '</gpx>',
    '',
  ].join('\n');
};
