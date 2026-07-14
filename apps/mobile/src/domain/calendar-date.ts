export const calendarDateInTimeZone = (instant: Date, timeZone: string): string | null => {
  if (!Number.isFinite(instant.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    }).formatToParts(instant);
    const value = Object.fromEntries(
      parts
        .filter(({ type }) => type === 'day' || type === 'month' || type === 'year')
        .map(({ type, value: part }) => [type, part]),
    );
    return value.year !== undefined && value.month !== undefined && value.day !== undefined
      ? `${value.year}-${value.month}-${value.day}`
      : null;
  } catch {
    return null;
  }
};
