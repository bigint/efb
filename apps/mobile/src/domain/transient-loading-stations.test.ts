import { describe, expect, it } from 'vitest';

import { parseTransientLoadingStations } from './transient-loading-stations';

describe('transient aircraft loading stations', () => {
  it('parses bounded labelled mass and arm rows', () => {
    expect(parseTransientLoadingStations('Baggage,18.5,1.42\nRear seats,120,1.18')).toEqual([
      { armMetres: 1.42, id: 'extra-1', label: 'Baggage', massKilograms: 18.5 },
      { armMetres: 1.18, id: 'extra-2', label: 'Rear seats', massKilograms: 120 },
    ]);
    expect(parseTransientLoadingStations('   ')).toEqual([]);
  });

  it('rejects ambiguous, duplicate, and malformed rows', () => {
    expect(() => parseTransientLoadingStations('Baggage,20')).toThrow('LABEL,MASS KG,ARM M');
    expect(() => parseTransientLoadingStations('Baggage,,1')).toThrow('required');
    expect(() => parseTransientLoadingStations('Baggage,20,1\nbaggage,10,2')).toThrow(
      'Duplicate',
    );
    expect(() => parseTransientLoadingStations('Bad\u0001label,20,1')).toThrow('control');
  });

  it('enforces row and numeric bounds', () => {
    expect(() => parseTransientLoadingStations('Cargo,-1,1')).toThrow('mass');
    expect(() => parseTransientLoadingStations('Cargo,1,21')).toThrow('arm');
    expect(() =>
      parseTransientLoadingStations(
        Array.from({ length: 9 }, (_, index) => `Station ${index},1,1`).join('\n'),
      ),
    ).toThrow('At most 8');
  });
});
