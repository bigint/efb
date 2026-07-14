import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

export function OwnshipGlyph() {
  return (
    <View accessibilityLabel="Simulated position. Track and heading unavailable.">
      <Canvas style={styles.canvas}>
        <Path path="M24 5 L43 24 L24 43 L5 24 Z" color="#6B4AA0" />
        <Circle cx={24} cy={24} r={7} color="#F7F9F8" />
        <Circle cx={24} cy={24} r={3} color="#6B4AA0" />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ canvas: { height: 48, width: 48 } });
