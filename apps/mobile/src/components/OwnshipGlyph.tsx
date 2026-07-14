import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

import { useDriftlineTheme } from '@/theme';

export function OwnshipGlyph({ origin }: { readonly origin: 'device' | 'simulated' }) {
  const theme = useDriftlineTheme();
  const colour = origin === 'simulated' ? theme.simulation : theme.accent;
  return (
    <View
      accessibilityLabel={
        origin === 'simulated'
          ? 'Simulated position. Track and heading unavailable.'
          : 'Device position. Supplemental awareness only.'
      }
    >
      <Canvas style={styles.canvas}>
        <Path path="M24 5 L43 24 L24 43 L5 24 Z" color={colour} />
        <Circle cx={24} cy={24} r={7} color="#F7F9F8" />
        <Circle cx={24} cy={24} r={3} color={colour} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ canvas: { height: 48, width: 48 } });
