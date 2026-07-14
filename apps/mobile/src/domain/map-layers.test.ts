import { describe, expect, it } from 'vitest';

import { defaultMapLayerVisibility, toggleMapLayer } from './map-layers';

describe('map layer visibility', () => {
  it('toggles one non-guidance layer without mutating the source', () => {
    const next = toggleMapLayer(defaultMapLayerVisibility, 'airports');
    expect(next).toEqual({
      airports: false,
      'demo-grid': true,
      'position-trail': true,
      'range-rings': true,
      'route-backdrop': true,
    });
    expect(defaultMapLayerVisibility.airports).toBe(true);
  });
});
