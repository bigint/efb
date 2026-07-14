import { dataProvenanceSchema } from '@driftline/data-contracts';
import {
  parseMetar,
  parseTafHeader,
  type AwcTafReport,
  type MetarObservation,
} from '@driftline/weather';
import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

const cachedWeatherSchema = z
  .object({
    observedAt: z.iso.datetime().nullable(),
    product: z.enum(['METAR', 'TAF']),
    raw: z.string().trim().min(1).max(8_192),
    retrievedAt: z.iso.datetime(),
    station: z.string().regex(/^[A-Z0-9]{4}$/u),
  })
  .strict()
  .superRefine((record, context) => {
    if ((record.product === 'METAR') !== (record.observedAt !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Cached weather timestamp shape is invalid',
      });
    }
  });

const weatherCacheKeySchema = z
  .object({
    product: z.enum(['METAR', 'TAF']),
    station: z.string().regex(/^[A-Z0-9]{4}$/u),
  })
  .strict();

export interface WeatherCacheRow {
  readonly observed_at: string | null;
  readonly product: string;
  readonly raw_text: string;
  readonly retrieved_at: string;
  readonly station: string;
}

export type CachedWeather =
  | { readonly observation: MetarObservation; readonly product: 'METAR' }
  | { readonly product: 'TAF'; readonly report: AwcTafReport };

const retrievalProvenance = (retrievedAt: string) =>
  dataProvenanceSchema.parse({
    confidence: 'unknown',
    datasetVersion: 'awc-data-api-v4-raw',
    effectiveAt: null,
    expiresAt: null,
    jurisdiction: 'WORLDWIDE',
    origin: 'real',
    retrievedAt,
    source: 'NOAA/NWS Aviation Weather Center Data API · local cache',
    sourceTimestamp: null,
    verificationStatus: 'source-verified',
  });

export const decodeCachedWeather = (
  rows: readonly WeatherCacheRow[],
): readonly CachedWeather[] =>
  rows.map((row) => {
    const record = cachedWeatherSchema.parse({
      observedAt: row.observed_at,
      product: row.product,
      raw: row.raw_text,
      retrievedAt: row.retrieved_at,
      station: row.station,
    });
    if (record.product === 'TAF') {
      const matches = record.raw.match(/\bTAF(?:\s+(?:AMD|COR))?\s+([A-Z0-9]{4})\b/gu) ?? [];
      const header = /^TAF(?:\s+(?:AMD|COR))?\s+([A-Z0-9]{4})\b/u.exec(record.raw);
      if (matches.length !== 1 || header?.[1] !== record.station) {
        throw new Error('Cached TAF station binding is invalid');
      }
      const parsed = parseTafHeader({
        provenance: retrievalProvenance(record.retrievedAt),
        raw: record.raw,
        receivedAt: record.retrievedAt,
      });
      if (parsed.station !== record.station)
        throw new Error('Cached TAF station binding is invalid');
      const report = {
        ...parsed,
        provenance: dataProvenanceSchema.parse({
          confidence: 'high',
          datasetVersion: 'awc-data-api-v4-raw',
          effectiveAt: parsed.validFrom,
          expiresAt: parsed.validTo,
          jurisdiction: 'WORLDWIDE',
          origin: 'real',
          retrievedAt: record.retrievedAt,
          source: 'NOAA/NWS Aviation Weather Center Data API · local cache',
          sourceTimestamp: parsed.issuedAt,
          verificationStatus: 'source-verified',
        }),
      };
      return {
        product: 'TAF',
        report,
      };
    }
    const preliminary = parseMetar({
      provenance: retrievalProvenance(record.retrievedAt),
      raw: record.raw,
      receivedAt: record.retrievedAt,
    });
    if (
      preliminary.station !== record.station ||
      preliminary.observedAt !== record.observedAt
    ) {
      throw new Error('Cached METAR station or observation time is invalid');
    }
    const observedAt = record.observedAt;
    const provenance = dataProvenanceSchema.parse({
      confidence: 'high',
      datasetVersion: 'awc-data-api-v4-raw',
      effectiveAt: observedAt,
      expiresAt: new Date(Date.parse(observedAt) + 60 * 60 * 1_000).toISOString(),
      jurisdiction: 'WORLDWIDE',
      origin: 'real',
      retrievedAt: record.retrievedAt,
      source: 'NOAA/NWS Aviation Weather Center Data API · local cache',
      sourceTimestamp: observedAt,
      verificationStatus: 'source-verified',
    });
    return { observation: { ...preliminary, provenance }, product: 'METAR' };
  });

export const listCachedWeather = async (
  database: SQLiteDatabase,
): Promise<readonly CachedWeather[]> => {
  const rows = await database.getAllAsync<WeatherCacheRow>(
    `SELECT product, station, raw_text, retrieved_at, observed_at
     FROM weather_cache ORDER BY retrieved_at DESC, product, station LIMIT 41`,
  );
  if (rows.length > 40) throw new Error('Weather cache exceeds supported limits');
  return decodeCachedWeather(rows);
};

export const cacheMetar = async (
  database: SQLiteDatabase,
  observation: MetarObservation,
): Promise<void> => {
  const record = cachedWeatherSchema.parse({
    observedAt: observation.observedAt,
    product: 'METAR',
    raw: observation.raw,
    retrievedAt: observation.receivedAt,
    station: observation.station,
  });
  await upsert(database, record);
};

export const cacheTaf = async (
  database: SQLiteDatabase,
  report: AwcTafReport,
): Promise<void> => {
  const record = cachedWeatherSchema.parse({
    observedAt: null,
    product: 'TAF',
    raw: report.raw,
    retrievedAt: report.receivedAt,
    station: report.station,
  });
  await upsert(database, record);
};

export const deleteCachedWeather = async (
  database: SQLiteDatabase,
  product: 'METAR' | 'TAF',
  station: string,
): Promise<boolean> => {
  const key = weatherCacheKeySchema.parse({ product, station });
  const result = await database.runAsync(
    'DELETE FROM weather_cache WHERE product = ? AND station = ?',
    key.product,
    key.station,
  );
  if (result.changes > 1) throw new Error('Weather cache deletion changed multiple rows');
  return result.changes === 1;
};

export const clearCachedWeather = async (database: SQLiteDatabase): Promise<number> => {
  const result = await database.runAsync('DELETE FROM weather_cache');
  return result.changes;
};

const upsert = async (
  database: SQLiteDatabase,
  record: z.infer<typeof cachedWeatherSchema>,
): Promise<void> => {
  await database.runAsync(
    `INSERT INTO weather_cache (product, station, raw_text, retrieved_at, observed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(product, station) DO UPDATE SET
       raw_text = excluded.raw_text,
       retrieved_at = excluded.retrieved_at,
       observed_at = excluded.observed_at
     WHERE unixepoch(excluded.retrieved_at) >= unixepoch(weather_cache.retrieved_at)`,
    record.product,
    record.station,
    record.raw,
    record.retrievedAt,
    record.observedAt,
  );
};
