import { dataProvenanceSchema, type DataProvenance } from '@driftline/data-contracts';

import { parseMetar, type MetarObservation } from './metar';

const AWC_ENDPOINTS = {
  METAR: 'https://aviationweather.gov/api/data/metar',
  TAF: 'https://aviationweather.gov/api/data/taf',
} as const;
const MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 60_000;
const REQUEST_TIMEOUT_MILLISECONDS = 10_000;

const containsUnexpectedControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
  });

export type AwcMetarErrorCode =
  | 'clock-invalid'
  | 'invalid-station'
  | 'no-data'
  | 'provider-error'
  | 'rate-limited'
  | 'response-invalid'
  | 'station-mismatch'
  | 'timeout';

export class AwcMetarError extends Error {
  public constructor(
    public readonly code: AwcMetarErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AwcMetarError';
  }
}

export interface AwcTafReport {
  readonly product: 'TAF';
  readonly provenance: DataProvenance;
  readonly raw: string;
  readonly receivedAt: string;
  readonly station: string;
}

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;
type Clock = () => Date;
type AwcProduct = keyof typeof AWC_ENDPOINTS;

interface RawProductResponse {
  readonly raw: string;
  readonly receivedAt: Date;
  readonly station: string;
}

export class AwcMetarClient {
  private lastRequestAt: number | null = null;

  public constructor(
    private readonly fetcher: Fetcher,
    private readonly clock: Clock,
  ) {}

  public async fetchLatest(stationInput: string): Promise<MetarObservation> {
    const { raw, receivedAt, station } = await this.fetchRaw('METAR', stationInput, 4_096, 1);
    let preliminary: MetarObservation;
    try {
      preliminary = parseMetar({
        provenance: this.createRetrievalProvenance(receivedAt),
        raw,
        receivedAt: receivedAt.toISOString(),
      });
    } catch {
      throw new AwcMetarError('response-invalid', 'Provider METAR failed the local parser.');
    }
    if (preliminary.station !== station) {
      throw new AwcMetarError('station-mismatch', 'Provider returned a different station.');
    }
    const observedAt = Date.parse(preliminary.observedAt);
    const provenance = dataProvenanceSchema.parse({
      confidence: 'high',
      datasetVersion: 'awc-data-api-v4-raw',
      effectiveAt: preliminary.observedAt,
      expiresAt: new Date(observedAt + 60 * 60 * 1_000).toISOString(),
      jurisdiction: 'WORLDWIDE',
      origin: 'real',
      retrievedAt: receivedAt.toISOString(),
      source: 'NOAA/NWS Aviation Weather Center Data API',
      sourceTimestamp: preliminary.observedAt,
      verificationStatus: 'source-verified',
    });
    return { ...preliminary, provenance };
  }

  public async fetchLatestTaf(stationInput: string): Promise<AwcTafReport> {
    const { raw, receivedAt, station } = await this.fetchRaw('TAF', stationInput, 8_192, 64);
    const headerMatches = raw.match(/\bTAF(?:\s+(?:AMD|COR))?\s+([A-Z0-9]{4})\b/gu) ?? [];
    if (headerMatches.length !== 1) {
      throw new AwcMetarError('response-invalid', 'Provider returned an invalid raw TAF body.');
    }
    const header = /^TAF(?:\s+(?:AMD|COR))?\s+([A-Z0-9]{4})\b/u.exec(raw);
    if (header?.[1] !== station) {
      throw new AwcMetarError('station-mismatch', 'Provider returned a different TAF station.');
    }
    return {
      product: 'TAF',
      provenance: this.createRetrievalProvenance(receivedAt),
      raw,
      receivedAt: receivedAt.toISOString(),
      station,
    };
  }

  private createRetrievalProvenance(receivedAt: Date): DataProvenance {
    return dataProvenanceSchema.parse({
      confidence: 'unknown',
      datasetVersion: 'awc-data-api-v4-raw',
      effectiveAt: null,
      expiresAt: null,
      jurisdiction: 'WORLDWIDE',
      origin: 'real',
      retrievedAt: receivedAt.toISOString(),
      source: 'NOAA/NWS Aviation Weather Center Data API',
      sourceTimestamp: null,
      verificationStatus: 'source-verified',
    });
  }

  private async fetchRaw(
    product: AwcProduct,
    stationInput: string,
    maximumLength: number,
    maximumLines: number,
  ): Promise<RawProductResponse> {
    const station = stationInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/u.test(station)) {
      throw new AwcMetarError(
        'invalid-station',
        'Enter one four-character station identifier.',
      );
    }
    const startedAt = this.clock().getTime();
    if (!Number.isFinite(startedAt)) {
      throw new AwcMetarError('clock-invalid', 'Device clock is invalid.');
    }
    if (this.lastRequestAt !== null && startedAt < this.lastRequestAt) {
      throw new AwcMetarError('clock-invalid', 'Device clock moved backwards.');
    }
    if (
      this.lastRequestAt !== null &&
      startedAt - this.lastRequestAt < MINIMUM_REQUEST_INTERVAL_MILLISECONDS
    ) {
      throw new AwcMetarError(
        'rate-limited',
        'Wait at least one minute between Aviation Weather Center requests.',
      );
    }
    this.lastRequestAt = startedAt;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLISECONDS);
    let response: Response;
    try {
      const query = new URLSearchParams({ format: 'raw', ids: station });
      response = await this.fetcher(`${AWC_ENDPOINTS[product]}?${query.toString()}`, {
        headers: { Accept: 'text/plain', 'User-Agent': 'Driftline/0.1' },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AwcMetarError('timeout', 'Aviation Weather Center request timed out.');
      }
      throw new AwcMetarError(
        'provider-error',
        error instanceof Error ? error.message : 'Aviation Weather Center request failed.',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 204) {
      throw new AwcMetarError('no-data', `No current ${product} is available for ${station}.`);
    }
    if (!response.ok) {
      throw new AwcMetarError(
        response.status === 429 ? 'rate-limited' : 'provider-error',
        `Aviation Weather Center returned HTTP ${response.status}.`,
      );
    }
    const raw = (await response.text()).trim();
    const lineCount = raw.split(/\r?\n/u).filter((line) => line.trim().length > 0).length;
    if (
      raw.length === 0 ||
      raw.length > maximumLength ||
      lineCount < 1 ||
      lineCount > maximumLines ||
      containsUnexpectedControlCharacter(raw)
    ) {
      throw new AwcMetarError(
        'response-invalid',
        `Provider returned an invalid raw ${product} body.`,
      );
    }
    const receivedAt = this.clock();
    if (!Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() < startedAt) {
      throw new AwcMetarError('clock-invalid', 'Device clock became invalid during retrieval.');
    }
    return { raw, receivedAt, station };
  }
}

export const awcMetarClient = new AwcMetarClient(fetch, () => new Date());
