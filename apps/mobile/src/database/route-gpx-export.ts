import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { createRouteGpx, type RouteGpxWaypoint } from '@/domain/route-gpx';

export type RouteGpxExportResult =
  | { readonly kind: 'share-sheet-closed'; readonly temporaryFileRetained: boolean }
  | { readonly kind: 'sharing-unavailable'; readonly uri: string };

const deleteBestEffort = (file: File): boolean => {
  try {
    if (file.exists) file.delete();
    return !file.exists;
  } catch {
    return false;
  }
};

export const exportRouteGpx = async (
  waypoints: readonly RouteGpxWaypoint[],
  createdAt = new Date(),
): Promise<RouteGpxExportResult> => {
  if (!Number.isFinite(createdAt.getTime())) throw new Error('Export time is invalid.');
  const gpx = createRouteGpx(waypoints);
  const directory = new Directory(Paths.cache, 'driftline-exports');
  directory.create({ idempotent: true, intermediates: true });
  const timestamp = createdAt.toISOString().replaceAll(/[:.]/gu, '-');
  const file = new File(directory, `driftline-route-${timestamp}.gpx`);
  file.create({ overwrite: false });
  try {
    file.write(gpx);
    if ((await file.text()) !== gpx) throw new Error('GPX export verification failed.');
    if (!(await Sharing.isAvailableAsync()))
      return { kind: 'sharing-unavailable', uri: file.uri };
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Export unverified Driftline route GPX',
      mimeType: 'application/gpx+xml',
      UTI: 'public.xml',
    });
    return { kind: 'share-sheet-closed', temporaryFileRetained: !deleteBestEffort(file) };
  } catch (caught) {
    deleteBestEffort(file);
    throw caught;
  }
};
