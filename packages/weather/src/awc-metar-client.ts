import { dataProvenanceSchema } from '@driftline/data-contracts';

import { parseMetar, type MetarObservation } from './metar';

const AWC_METAR_ENDPOINT = 'https://aviationweather.gov/api/data/metar';
const MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 60_000;
const REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const MAXIMUM_RAW_RESPONSE_LENGTH = 4_096;

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

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;
type Clock = () => Date;

export class AwcMetarClient {
  private lastRequestAt: number | null = null;

  public constructor(
    private readonly fetcher: Fetcher,
    private readonly clock: Clock,
  ) {}

  public async fetchLatest(stationInput: string): Promise<MetarObservation> {
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
      response = await this.fetcher(`${AWC_METAR_ENDPOINT}?${query.toString()}`, {
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
      throw new AwcMetarError('no-data', `No current METAR is available for ${station}.`);
    }
    if (!response.ok) {
      throw new AwcMetarError(
        response.status === 429 ? 'rate-limited' : 'provider-error',
        `Aviation Weather Center returned HTTP ${response.status}.`,
      );
    }
    const raw = (await response.text()).trim();
    if (
      raw.length === 0 ||
      raw.length > MAXIMUM_RAW_RESPONSE_LENGTH ||
      raw.split(/\r?\n/u).filter((line) => line.trim().length > 0).length !== 1
    ) {
      throw new AwcMetarError(
        'response-invalid',
        'Provider returned an invalid raw METAR body.',
      );
    }
    const receivedAt = this.clock();
    if (!Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() < startedAt) {
      throw new AwcMetarError('clock-invalid', 'Device clock became invalid during retrieval.');
    }
    let preliminary: MetarObservation;
    try {
      preliminary = parseMetar({
        provenance: {
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
        },
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
}

export const awcMetarClient = new AwcMetarClient(fetch, () => new Date());
