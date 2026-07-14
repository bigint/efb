import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { radii, spacing, typography } from '@driftline/design-system';
import { StyleSheet, Text, View } from 'react-native';

import { presentOwnship } from '@/domain/ownship-presentation';
import { useDriftlineTheme } from '@/theme';

export function OwnshipGlyph({
  accuracyMetres,
  origin,
  trackDegrees,
  trackReference,
}: {
  readonly accuracyMetres: number | null;
  readonly origin: 'device' | 'simulated';
  readonly trackDegrees: number | null;
  readonly trackReference: 'platform' | 'true';
}) {
  const theme = useDriftlineTheme();
  const colour = origin === 'simulated' ? theme.simulation : theme.accent;
  const presentation = presentOwnship({
    accuracyMetres,
    origin,
    trackDegrees,
    trackReference,
  });
  return (
    <View
      accessibilityLabel={presentation.accessibilityLabel}
      accessibilityRole="image"
      accessible
      style={styles.container}
    >
      <Canvas
        style={[
          styles.canvas,
          trackDegrees === null ? undefined : { transform: [{ rotate: `${trackDegrees}deg` }] },
        ]}
      >
        {trackDegrees === null ? (
          <>
            <Circle cx={24} cy={24} r={15} color={colour} style="stroke" strokeWidth={4} />
            <Circle cx={24} cy={24} r={4} color={colour} />
          </>
        ) : (
          <>
            <Path path="M24 3 L40 42 L24 33 L8 42 Z" color={colour} />
            <Circle cx={24} cy={26} r={5} color={theme.background} />
          </>
        )}
      </Canvas>
      <Text
        numberOfLines={1}
        style={[
          styles.badge,
          {
            backgroundColor: theme.panelRaised,
            borderColor: colour,
            color: theme.primary,
          },
        ]}
      >
        {presentation.badge}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.control,
    borderWidth: 1,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    position: 'absolute',
    top: 44,
  },
  canvas: { height: 48, width: 48 },
  container: { alignItems: 'center', height: 48, width: 160 },
});
