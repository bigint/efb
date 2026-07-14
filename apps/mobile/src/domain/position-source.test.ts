import { describe, expect, it } from 'vitest';

import { greatCircleDistance, position } from '@driftline/geospatial';

import {
  advanceSimulationSample,
  evaluatePosition,
  holdSimulationSample,
  mapDeviceLocation,
  type PositionSample,
} from './position-source';

const sample: PositionSample = {
  altitudeFeet: 4_500,
  groundspeedKnots: 118,
  horizontalAccuracyMetres: 50,
  latitude: 12,
  longitude: 77,
  sampledAt: 10_000,
  trackDegrees: null,
  trackReference: 'true',
};

describe('position source evaluation', () => {
  it('advances a deterministic true-track simulation by elapsed time', () => {
    const origin = position(0, 0);
    const first = advanceSimulationSample({
      altitudeFeet: 4_500,
      groundspeedKnots: 120,
      horizontalAccuracyMetres: 50,
      origin,
      previous: null,
      sampledAt: 10_000,
      trackTrueDegrees: 90,
      verticalSpeedFeetPerMinute: 0,
    });
    const second = advanceSimulationSample({
      altitudeFeet: 4_500,
      groundspeedKnots: 120,
      horizontalAccuracyMetres: 50,
      origin,
      previous: first,
      sampledAt: 11_000,
      trackTrueDegrees: 90,
      verticalSpeedFeetPerMinute: 600,
    });
    expect(second.latitude).toBeCloseTo(0, 10);
    expect(second.longitude).toBeGreaterThan(first.longitude);
    expect(
      greatCircleDistance(
        position(first.latitude, first.longitude),
        position(second.latitude, second.longitude),
      ),
    ).toBeCloseTo(120 / 3_600, 10);
    expect(second.trackDegrees).toBe(90);
    expect(second.trackReference).toBe('true');
    expect(second.altitudeFeet).toBeCloseTo(4_510);
  });

  it('pauses movement across long lifecycle gaps and rejects clock reversal', () => {
    const origin = position(12, 77);
    const first = advanceSimulationSample({
      altitudeFeet: 4_500,
      groundspeedKnots: 120,
      horizontalAccuracyMetres: 50,
      origin,
      previous: null,
      sampledAt: 10_000,
      trackTrueDegrees: 90,
      verticalSpeedFeetPerMinute: 500,
    });
    expect(
      advanceSimulationSample({
        altitudeFeet: 4_500,
        groundspeedKnots: 120,
        horizontalAccuracyMetres: 50,
        origin,
        previous: first,
        sampledAt: 20_000,
        trackTrueDegrees: 90,
        verticalSpeedFeetPerMinute: 500,
      }),
    ).toMatchObject({
      latitude: first.latitude,
      longitude: first.longitude,
      sampledAt: 20_000,
      altitudeFeet: first.altitudeFeet,
    });
    expect(() =>
      advanceSimulationSample({
        altitudeFeet: 4_500,
        groundspeedKnots: 120,
        horizontalAccuracyMetres: 50,
        origin,
        previous: first,
        sampledAt: 9_999,
        trackTrueDegrees: 90,
        verticalSpeedFeetPerMinute: 0,
      }),
    ).toThrow('backwards');
  });

  it('holds an established simulation sample without aging or moving it', () => {
    expect(holdSimulationSample(sample, 11_000)).toEqual({ ...sample, sampledAt: 11_000 });
    expect(holdSimulationSample(sample, sample.sampledAt)).toBe(sample);
    expect(() => holdSimulationSample(sample, 9_999)).toThrow('clock moved backwards');
    expect(() => holdSimulationSample(sample, Number.NaN)).toThrow('clock moved backwards');
    expect(() =>
      holdSimulationSample({ ...sample, trackReference: 'unsafe' as never }, 11_000),
    ).toThrow('clock moved backwards');
  });

  it('rejects a climb that would leave the supported altitude envelope', () => {
    expect(() =>
      advanceSimulationSample({
        altitudeFeet: 99_999,
        groundspeedKnots: 120,
        horizontalAccuracyMetres: 50,
        origin: position(12, 77),
        previous: { ...sample, altitudeFeet: 99_999 },
        sampledAt: 11_000,
        trackTrueDegrees: 90,
        verticalSpeedFeetPerMinute: 6_000,
      }),
    ).toThrow('altitude');
  });

  it('exposes a fresh simulated sample with age and origin', () => {
    expect(evaluatePosition({ gpsAvailable: true, kind: 'simulated' }, sample, 10_500)).toEqual(
      {
        ageMilliseconds: 500,
        kind: 'available',
        origin: 'simulated',
        sample,
      },
    );
  });

  it('maps nullable platform location values without inventing telemetry', () => {
    const device = mapDeviceLocation({
      accuracyMetres: null,
      altitudeMetres: -10,
      headingDegrees: null,
      latitude: 12,
      longitude: 77,
      speedMetresPerSecond: null,
      timestamp: 10_000,
    });
    expect(device).toMatchObject({
      groundspeedKnots: null,
      horizontalAccuracyMetres: null,
      trackDegrees: null,
      trackReference: 'platform',
    });
    expect(device.altitudeFeet).toBeCloseTo(-32.80839895);
  });

  it('converts device speed and altitude into explicit cockpit units', () => {
    const device = mapDeviceLocation({
      accuracyMetres: 8,
      altitudeMetres: 1_000,
      headingDegrees: 90,
      latitude: 12,
      longitude: 77,
      speedMetresPerSecond: 10,
      timestamp: 10_000,
    });
    expect(device.altitudeFeet).toBeCloseTo(3_280.839895);
    expect(device.groundspeedKnots).toBeCloseTo(19.43844492);
    expect(
      evaluatePosition({ kind: 'device', status: 'watching' }, device, 10_500),
    ).toMatchObject({ kind: 'available', origin: 'device' });
  });

  it.each([
    ['permission-required', 'location-permission-required'],
    ['permission-denied', 'location-permission-denied'],
    ['service-disabled', 'location-service-disabled'],
    ['error', 'device-error'],
  ] as const)('maps device status %s to %s', (status, reason) => {
    expect(evaluatePosition({ kind: 'device', status }, null, 10_500)).toEqual({
      kind: 'unavailable',
      reason,
    });
  });

  it.each([
    [{ kind: 'disabled' }, sample, 10_500, 'no-active-source'],
    [{ gpsAvailable: false, kind: 'simulated' }, sample, 10_500, 'gps-outage'],
    [{ gpsAvailable: true, kind: 'simulated' }, null, 10_500, 'no-sample'],
    [{ gpsAvailable: true, kind: 'simulated' }, sample, 13_001, 'stale-sample'],
    [{ gpsAvailable: true, kind: 'simulated' }, sample, 9_999, 'clock-invalid'],
  ] as const)('fails closed for %s', (scenario, value, now, reason) => {
    expect(evaluatePosition(scenario, value, now)).toEqual({ kind: 'unavailable', reason });
  });

  it.each([
    [{ ...sample, sampledAt: Number.NaN }, 10_500],
    [{ ...sample, horizontalAccuracyMetres: Number.NaN }, 10_500],
    [{ ...sample, horizontalAccuracyMetres: -1 }, 10_500],
    [{ ...sample, latitude: 91 }, 10_500],
    [{ ...sample, groundspeedKnots: -1 }, 10_500],
    [{ ...sample, groundspeedKnots: 2_001 }, 10_500],
    [{ ...sample, altitudeFeet: 100_001 }, 10_500],
    [{ ...sample, trackDegrees: 360 }, 10_500],
    [{ ...sample, trackReference: 'magnetic' as never }, 10_500],
    [{ ...sample, sampledAt: -1 }, 10_500],
  ] as const)('rejects a non-finite or out-of-domain sample %#', (value, now) => {
    expect(evaluatePosition({ gpsAvailable: true, kind: 'simulated' }, value, now)).toEqual({
      kind: 'unavailable',
      reason: 'sample-invalid',
    });
  });

  it('rejects a non-finite evaluation clock', () => {
    expect(
      evaluatePosition({ gpsAvailable: true, kind: 'simulated' }, sample, Number.NaN),
    ).toEqual({ kind: 'unavailable', reason: 'clock-invalid' });
    expect(evaluatePosition({ gpsAvailable: true, kind: 'simulated' }, sample, -1)).toEqual({
      kind: 'unavailable',
      reason: 'clock-invalid',
    });
  });

  it('rejects implausibly unbounded device telemetry before storage', () => {
    expect(() =>
      mapDeviceLocation({
        accuracyMetres: 8,
        altitudeMetres: 40_000,
        headingDegrees: 90,
        latitude: 12,
        longitude: 77,
        speedMetresPerSecond: 10,
        timestamp: 10_000,
      }),
    ).toThrow('altitude');
    expect(() =>
      mapDeviceLocation({
        accuracyMetres: 8,
        altitudeMetres: 1_000,
        headingDegrees: 90,
        latitude: 12,
        longitude: 77,
        speedMetresPerSecond: 10,
        timestamp: -1,
      }),
    ).toThrow('timestamp');
  });
});
