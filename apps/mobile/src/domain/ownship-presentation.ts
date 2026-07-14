export interface OwnshipPresentationInput {
  readonly accuracyMetres: number | null;
  readonly origin: 'device' | 'simulated';
  readonly trackDegrees: number | null;
  readonly trackReference: 'platform' | 'true';
}

const formatAccuracy = (
  metres: number | null,
): { readonly badge: string; readonly spoken: string } => {
  if (metres === null) return { badge: 'ACC —', spoken: 'horizontal accuracy unknown' };
  if (metres < 1_000) {
    const rounded = Math.round(metres);
    return {
      badge: `±${rounded} M`,
      spoken: `horizontal accuracy plus or minus ${rounded} metres`,
    };
  }
  const kilometres = (metres / 1_000).toFixed(1);
  return {
    badge: `±${kilometres} KM`,
    spoken: `horizontal accuracy plus or minus ${kilometres} kilometres`,
  };
};

export const presentOwnship = (input: OwnshipPresentationInput) => {
  const source = input.origin === 'simulated' ? 'SIM' : 'DEVICE';
  const sourceSpoken = input.origin === 'simulated' ? 'Simulated position' : 'Device position';
  const accuracy = formatAccuracy(input.accuracyMetres);
  const track =
    input.trackDegrees === null
      ? { badge: 'TRACK —', spoken: 'course unavailable' }
      : {
          badge: `${Math.round(input.trackDegrees).toString().padStart(3, '0')}°${input.trackReference === 'true' ? 'T' : ' PLATFORM'}`,
          spoken: `${input.trackReference === 'true' ? 'true track' : 'platform course'} ${Math.round(input.trackDegrees)} degrees`,
        };
  return {
    accessibilityLabel: `${sourceSpoken}, ${accuracy.spoken}, ${track.spoken}. Supplemental awareness only.`,
    badge: `${source} ${accuracy.badge} · ${track.badge}`,
  };
};
