export type MapLayerId = 'airports' | 'demo-grid' | 'range-rings' | 'route-backdrop';

export type MapLayerVisibility = Readonly<Record<MapLayerId, boolean>>;

export const defaultMapLayerVisibility: MapLayerVisibility = {
  airports: true,
  'demo-grid': true,
  'range-rings': true,
  'route-backdrop': true,
};

export const toggleMapLayer = (
  current: MapLayerVisibility,
  layer: MapLayerId,
): MapLayerVisibility => ({ ...current, [layer]: !current[layer] });
