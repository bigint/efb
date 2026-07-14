import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

interface OwnshipGlyphProps {
  readonly degraded: boolean;
}

export function OwnshipGlyph({ degraded }: OwnshipGlyphProps) {
  return (
    <View accessibilityLabel={degraded ? 'Simulated GPS unavailable' : 'Simulated own ship'}>
      <Canvas style={styles.canvas}>
        <Circle cx={24} cy={24} r={20} color={degraded ? '#B4282F33' : '#6B4AA033'} />
        <Circle cx={24} cy={24} r={10} color={degraded ? '#B4282F66' : '#6B4AA066'} />
        {!degraded && <Path path="M24 5 L31 35 L24 30 L17 35 Z" color="#F7F9F8" />}
        {degraded && (
          <Path path="M15 15 L33 33 M33 15 L15 33" color="#F7F9F8" strokeWidth={4} />
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ canvas: { height: 48, width: 48 } });
