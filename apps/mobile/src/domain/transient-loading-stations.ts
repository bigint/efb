export interface TransientLoadingStation {
  readonly armMetres: number;
  readonly id: string;
  readonly label: string;
  readonly massKilograms: number;
}

const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });

export const parseTransientLoadingStations = (
  value: string,
): readonly TransientLoadingStation[] => {
  if (hasControlCharacter(value.replaceAll('\n', '').replaceAll('\r', ''))) {
    throw new Error('Loading station labels cannot contain control characters.');
  }
  const lines = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length > 8) throw new Error('At most 8 extra loading stations are supported.');

  const labels = new Set<string>();
  return lines.map((line, index) => {
    const parts = line.split(',').map((part) => part.trim());
    if (parts.length !== 3) {
      throw new Error(`Loading station line ${index + 1} must be LABEL,MASS KG,ARM M.`);
    }
    const label = parts[0] ?? '';
    if (label.length === 0 || label.length > 32) {
      throw new Error(`Loading station line ${index + 1} label must be 1 to 32 characters.`);
    }
    const normalizedLabel = label.toUpperCase();
    if (labels.has(normalizedLabel))
      throw new Error(`Duplicate loading station label: ${label}.`);
    labels.add(normalizedLabel);

    if ((parts[1] ?? '').length === 0 || (parts[2] ?? '').length === 0) {
      throw new Error(`Loading station line ${index + 1} mass and arm are required.`);
    }
    const massKilograms = Number(parts[1]);
    const armMetres = Number(parts[2]);
    if (!Number.isFinite(massKilograms) || massKilograms < 0 || massKilograms > 100_000) {
      throw new Error(`Loading station line ${index + 1} mass must be 0 to 100000 KG.`);
    }
    if (!Number.isFinite(armMetres) || armMetres < 0 || armMetres > 20) {
      throw new Error(`Loading station line ${index + 1} arm must be 0 to 20 M.`);
    }
    return {
      armMetres,
      id: `extra-${index + 1}`,
      label,
      massKilograms,
    };
  });
};
