import { describe, expect, it } from 'vitest';

import { position } from '@driftline/geospatial';

import { createRouteGpx, ROUTE_GPX_WAYPOINT_LIMIT } from './route-gpx';

describe('route GPX export', () => {
  it('writes a deterministic route without inventing timestamps or elevations', () => {
    const gpx = createRouteGpx([
      { identifier: 'A&B', position: position(12.34567894, -98.76543216) },
      { identifier: '<DEST>', position: position(-1, 179.99999999) },
    ]);

    expect(gpx).toContain('lat="12.3456789" lon="-98.7654322"');
    expect(gpx).toContain('<name>A&amp;B</name>');
    expect(gpx).toContain('<name>&lt;DEST&gt;</name>');
    expect(gpx).toContain('FICTIONAL AND UNVERIFIED');
    expect(gpx).not.toContain('<time>');
    expect(gpx).not.toContain('<ele>');
    expect(gpx.endsWith('\n')).toBe(true);
  });

  it('rejects incomplete, duplicate, invalid-coordinate, and unbounded routes', () => {
    const first = { identifier: 'ONE', position: position(0, 0) };
    expect(() => createRouteGpx([first])).toThrow('at least two');
    expect(() => createRouteGpx([first, first])).toThrow('duplicate');
    expect(() =>
      createRouteGpx([
        first,
        { identifier: 'TWO', position: { latitude: 91, longitude: 0 } as never },
      ]),
    ).toThrow('Latitude');
    expect(() =>
      createRouteGpx(
        Array.from({ length: ROUTE_GPX_WAYPOINT_LIMIT + 1 }, (_, index) => ({
          identifier: `P${index}`,
          position: position(0, index),
        })),
      ),
    ).toThrow('at most');
  });

  it('rejects XML control characters instead of emitting malformed XML', () => {
    expect(() =>
      createRouteGpx([
        { identifier: 'ONE', position: position(0, 0) },
        { identifier: 'BAD\u0000', position: position(1, 1) },
      ]),
    ).toThrow('XML 1.0');
  });
});
