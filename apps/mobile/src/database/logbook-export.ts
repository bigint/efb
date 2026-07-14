import type { LogbookEntry } from '@driftline/aviation-domain';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { createLogbookCsv } from '@/domain/logbook-csv';

export type LogbookExportResult =
  | {
      readonly kind: 'share-sheet-closed';
      readonly entryCount: number;
      readonly temporaryFileRetained: boolean;
    }
  | { readonly kind: 'sharing-unavailable'; readonly entryCount: number; readonly uri: string };

const deleteBestEffort = (file: File): boolean => {
  try {
    if (file.exists) file.delete();
    return !file.exists;
  } catch {
    return false;
  }
};

export const exportLogbookCsv = async (
  entries: readonly LogbookEntry[],
  createdAt = new Date(),
): Promise<LogbookExportResult> => {
  if (!Number.isFinite(createdAt.getTime())) throw new Error('Export time is invalid.');
  const csv = createLogbookCsv(entries);
  const directory = new Directory(Paths.cache, 'driftline-exports');
  directory.create({ idempotent: true, intermediates: true });
  const timestamp = createdAt.toISOString().replaceAll(/[:.]/gu, '-');
  const file = new File(directory, `driftline-logbook-${timestamp}.csv`);
  file.create({ overwrite: false });
  try {
    file.write(csv);
    if ((await file.text()) !== csv) throw new Error('CSV export verification failed.');
    if (!(await Sharing.isAvailableAsync())) {
      return { entryCount: entries.length, kind: 'sharing-unavailable', uri: file.uri };
    }
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Export Driftline logbook CSV',
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });
    return {
      entryCount: entries.length,
      kind: 'share-sheet-closed',
      temporaryFileRetained: !deleteBestEffort(file),
    };
  } catch (caught) {
    deleteBestEffort(file);
    throw caught;
  }
};
