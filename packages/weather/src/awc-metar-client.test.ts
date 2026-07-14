import { describe, expect, it, vi } from 'vitest';

import { AwcMetarClient, AwcMetarError } from './awc-metar-client';

const now = new Date('2026-07-14T08:00:00.000Z');
const response = (body: string, status = 200): Response =>
  new Response(status === 204 ? null : body, { status });

describe('AWC METAR client', () => {
  it('retrieves one bounded raw report with source provenance', async () => {
    const fetcher = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(response('METAR KMCI 140753Z 11004KT 10SM CLR 24/19 A3019'));
    const client = new AwcMetarClient(fetcher, () => now);
    await expect(client.fetchLatest('kmci')).resolves.toMatchObject({
      observedAt: '2026-07-14T07:53:00.000Z',
      provenance: {
        datasetVersion: 'awc-data-api-v4-raw',
        verificationStatus: 'source-verified',
      },
      station: 'KMCI',
    });
    const call = fetcher.mock.calls[0];
    if (call === undefined) throw new Error('Expected one provider call.');
    expect(call[0]).toBe('https://aviationweather.gov/api/data/metar?format=raw&ids=KMCI');
    expect(new Headers(call[1].headers).get('Accept')).toBe('text/plain');
  });

  it('enforces a one-minute client request interval even after a response', async () => {
    const fetcher = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(response('METAR KMCI 140753Z 11004KT 10SM CLR 24/19 A3019'));
    const client = new AwcMetarClient(fetcher, () => now);
    await client.fetchLatest('KMCI');
    await expect(client.fetchLatest('KSEA')).rejects.toMatchObject({ code: 'rate-limited' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retrieves one bounded multiline raw TAF without decoding forecast groups', async () => {
    const fetcher = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        response('TAF KMCI 140520Z 1406/1506 VRB04KT P6SM SKC\n  TEMPO 1410/1412 4SM BR'),
      );
    const client = new AwcMetarClient(fetcher, () => now);
    await expect(client.fetchLatestTaf('kmci')).resolves.toMatchObject({
      product: 'TAF',
      provenance: { verificationStatus: 'source-verified' },
      station: 'KMCI',
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://aviationweather.gov/api/data/taf?format=raw&ids=KMCI',
    );
  });

  it('shares one provider request gate across METAR and TAF', async () => {
    const fetcher = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(response('METAR KMCI 140753Z 11004KT 10SM CLR 24/19 A3019'));
    const client = new AwcMetarClient(fetcher, () => now);
    await client.fetchLatest('KMCI');
    await expect(client.fetchLatestTaf('KMCI')).rejects.toMatchObject({ code: 'rate-limited' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('distinguishes no data, provider throttling, and station mismatch', async () => {
    const noData = new AwcMetarClient(
      () => Promise.resolve(response('', 204)),
      () => now,
    );
    await expect(noData.fetchLatest('KMCI')).rejects.toMatchObject({ code: 'no-data' });
    const throttled = new AwcMetarClient(
      () => Promise.resolve(response('', 429)),
      () => now,
    );
    await expect(throttled.fetchLatest('KMCI')).rejects.toMatchObject({ code: 'rate-limited' });
    const mismatch = new AwcMetarClient(
      () => Promise.resolve(response('METAR KSEA 140753Z 11004KT 10SM CLR 24/19 A3019')),
      () => now,
    );
    await expect(mismatch.fetchLatest('KMCI')).rejects.toMatchObject({
      code: 'station-mismatch',
    });
  });

  it('rejects invalid identifiers and multi-report bodies before display', async () => {
    const client = new AwcMetarClient(
      () =>
        Promise.resolve(
          response(
            'METAR KMCI 140753Z 11004KT 10SM CLR 24/19 A3019\nMETAR KMCI 140653Z 00000KT',
          ),
        ),
      () => now,
    );
    await expect(client.fetchLatest('../')).rejects.toBeInstanceOf(AwcMetarError);
    await expect(client.fetchLatest('KMCI')).rejects.toMatchObject({
      code: 'response-invalid',
    });
  });

  it('rejects malformed or implausibly large declared response lengths', async () => {
    for (const contentLength of ['not-a-number', '16385']) {
      const client = new AwcMetarClient(
        () =>
          Promise.resolve(
            new Response('METAR KMCI 140753Z 11004KT 10SM CLR 24/19 A3019', {
              headers: { 'Content-Length': contentLength },
            }),
          ),
        () => now,
      );
      await expect(client.fetchLatest('KMCI')).rejects.toMatchObject({
        code: 'response-invalid',
      });
    }
  });

  it('rejects a mismatched or multi-report TAF response', async () => {
    const mismatch = new AwcMetarClient(
      () => Promise.resolve(response('TAF KSEA 140520Z 1406/1506 VRB04KT P6SM SKC')),
      () => now,
    );
    await expect(mismatch.fetchLatestTaf('KMCI')).rejects.toMatchObject({
      code: 'station-mismatch',
    });
    const multiple = new AwcMetarClient(
      () =>
        Promise.resolve(
          response(
            'TAF KMCI 140520Z 1406/1506 VRB04KT P6SM SKC\nTAF KMCI 141120Z 1412/1512 VRB05KT P6SM SKC',
          ),
        ),
      () => now,
    );
    await expect(multiple.fetchLatestTaf('KMCI')).rejects.toMatchObject({
      code: 'response-invalid',
    });
  });

  it('aborts a provider request after the bounded timeout', async () => {
    vi.useFakeTimers();
    try {
      const client = new AwcMetarClient(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
        () => now,
      );
      const pending = client.fetchLatest('KMCI');
      const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed when the injected clock reverses', async () => {
    const times = [now, new Date(now.getTime() - 1)];
    const client = new AwcMetarClient(
      () => Promise.resolve(response('METAR KMCI 140753Z 11004KT 10SM CLR 24/19 A3019')),
      () => times.shift() ?? now,
    );
    await expect(client.fetchLatest('KMCI')).rejects.toMatchObject({ code: 'clock-invalid' });
  });
});
