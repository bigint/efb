import { z } from 'zod';

export const flightWaypointSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{1,16}$/u),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    sequence: z.number().int().min(0).max(99),
    sourceRef: z.string().trim().min(1).max(256),
  })
  .strict();

export const savedFlightPlanSchema = z
  .object({
    aircraftId: z.uuid().nullable(),
    altitudeFeet: z.number().int().min(0).max(60_000).nullable(),
    createdAt: z.iso.datetime(),
    departureTime: z.iso.datetime().nullable(),
    id: z.uuid(),
    notes: z.string().max(10_000),
    revision: z.number().int().min(1),
    status: z.enum(['active', 'archived', 'draft']),
    title: z.string().trim().min(1).max(120),
    updatedAt: z.iso.datetime(),
    waypoints: z.array(flightWaypointSchema).max(100),
  })
  .strict()
  .superRefine((plan, context) => {
    if (Date.parse(plan.updatedAt) < Date.parse(plan.createdAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Updated time cannot precede created time',
        path: ['updatedAt'],
      });
    }
    const identifiers = new Set<string>();
    plan.waypoints.forEach((waypoint, index) => {
      if (waypoint.sequence !== index) {
        context.addIssue({
          code: 'custom',
          message: 'Waypoint sequence must be contiguous from zero',
          path: ['waypoints', index, 'sequence'],
        });
      }
      if (identifiers.has(waypoint.identifier)) {
        context.addIssue({
          code: 'custom',
          message: 'Waypoint identifiers must be unique within a saved plan',
          path: ['waypoints', index, 'identifier'],
        });
      }
      identifiers.add(waypoint.identifier);
    });
  });

export type FlightWaypoint = z.infer<typeof flightWaypointSchema>;
export type SavedFlightPlan = z.infer<typeof savedFlightPlanSchema>;

export interface AvailableFlightWaypoint {
  readonly identifier: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sourceRef: string;
}

export type SavedFlightResolution =
  | { readonly identifiers: readonly string[]; readonly status: 'ready' }
  | { readonly mismatchedIdentifiers: readonly string[]; readonly status: 'dataset-mismatch' };

export const resolveSavedFlightPlan = (
  source: SavedFlightPlan,
  available: readonly AvailableFlightWaypoint[],
): SavedFlightResolution => {
  const plan = savedFlightPlanSchema.parse(source);
  const byIdentifier = new Map<string, AvailableFlightWaypoint>();
  for (const waypoint of available) {
    if (byIdentifier.has(waypoint.identifier)) {
      throw new Error('Available flight waypoints must be unique.');
    }
    byIdentifier.set(waypoint.identifier, waypoint);
  }
  const mismatchedIdentifiers = plan.waypoints
    .filter((waypoint) => {
      const candidate = byIdentifier.get(waypoint.identifier);
      return (
        candidate === undefined ||
        candidate.latitude !== waypoint.latitude ||
        candidate.longitude !== waypoint.longitude ||
        candidate.sourceRef !== waypoint.sourceRef
      );
    })
    .map(({ identifier }) => identifier);
  return mismatchedIdentifiers.length === 0
    ? { identifiers: plan.waypoints.map(({ identifier }) => identifier), status: 'ready' }
    : { mismatchedIdentifiers, status: 'dataset-mismatch' };
};
