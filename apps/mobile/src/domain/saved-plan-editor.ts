import { z } from 'zod';

const utcDepartureSchema = z.iso.datetime({ offset: false });

export interface SavedPlanEditorInput {
  readonly aircraftId: string | null;
  readonly altitudeFeet: string;
  readonly departureTime: string;
  readonly notes: string;
  readonly title: string;
}

export interface SavedPlanEditorChanges {
  readonly aircraftId: string | null;
  readonly altitudeFeet: number | null;
  readonly departureTime: string | null;
  readonly notes: string;
  readonly title: string;
}

export const parseSavedPlanEditor = (input: SavedPlanEditorInput): SavedPlanEditorChanges => {
  const altitude = input.altitudeFeet.trim();
  if (altitude.length > 0 && !/^(?:0|[1-9]\d*)$/u.test(altitude)) {
    throw new Error('Cruise altitude must be a whole number of feet from 0 to 60,000.');
  }
  const altitudeFeet = altitude.length === 0 ? null : Number(altitude);
  if (altitudeFeet !== null && altitudeFeet > 60_000) {
    throw new Error('Cruise altitude must be a whole number of feet from 0 to 60,000.');
  }

  const departure = input.departureTime.trim();
  const parsedDeparture =
    departure.length === 0 ? null : utcDepartureSchema.safeParse(departure);
  if (parsedDeparture !== null && !parsedDeparture.success) {
    throw new Error('Departure time must be UTC ISO format, for example 2026-07-14T12:30:00Z.');
  }

  const title = input.title.trim();
  if (title.length === 0) throw new Error('Saved flight title is required.');

  return {
    aircraftId: input.aircraftId,
    altitudeFeet,
    departureTime: parsedDeparture === null ? null : parsedDeparture.data,
    notes: input.notes,
    title,
  };
};
