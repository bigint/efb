import { z } from 'zod';

export const simulationProfileSchema = z
  .object({
    altitudeFeet: z.number().finite().min(-4_000).max(100_000),
    groundspeedKnots: z.number().finite().min(0).max(2_000),
    horizontalAccuracyMetres: z.number().finite().min(0).max(1_000_000),
    startingAirportIdentifier: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{1,16}$/u),
    trackTrueDegrees: z.number().finite().min(0).lt(360),
    verticalSpeedFeetPerMinute: z.number().finite().min(-10_000).max(10_000),
  })
  .strict();

export type SimulationProfile = z.infer<typeof simulationProfileSchema>;

export const defaultSimulationProfile: SimulationProfile = {
  altitudeFeet: 4_500,
  groundspeedKnots: 118,
  horizontalAccuracyMetres: 50,
  startingAirportIdentifier: 'DVL1',
  trackTrueDegrees: 68,
  verticalSpeedFeetPerMinute: 0,
};

export interface SimulationProfileTextInput {
  readonly altitudeFeet: string;
  readonly groundspeedKnots: string;
  readonly horizontalAccuracyMetres: string;
  readonly startingAirportIdentifier: string;
  readonly trackTrueDegrees: string;
  readonly verticalSpeedFeetPerMinute: string;
}

export const parseSimulationProfileText = (
  input: SimulationProfileTextInput,
): SimulationProfile => {
  const numeric = (value: string, label: string): number => {
    if (value.trim().length === 0) throw new Error(`${label} is required`);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`);
    return parsed;
  };
  const parsed = simulationProfileSchema.safeParse({
    altitudeFeet: numeric(input.altitudeFeet, 'Altitude'),
    groundspeedKnots: numeric(input.groundspeedKnots, 'Groundspeed'),
    horizontalAccuracyMetres: numeric(input.horizontalAccuracyMetres, 'GPS accuracy'),
    startingAirportIdentifier: input.startingAirportIdentifier,
    trackTrueDegrees: numeric(input.trackTrueDegrees, 'True track'),
    verticalSpeedFeetPerMinute: numeric(input.verticalSpeedFeetPerMinute, 'Vertical speed'),
  });
  if (!parsed.success) throw new Error('Simulation profile is outside supported bounds');
  return parsed.data;
};
