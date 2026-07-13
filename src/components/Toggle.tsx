import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { colors } from '@/theme';

const KNOB_OFF = 3;
const KNOB_ON = 21;

export function Toggle({ value, onPress }: { value: boolean; onPress: () => void }) {
  const knobLeft = useRef(new Animated.Value(value ? KNOB_ON : KNOB_OFF)).current;

  useEffect(() => {
    Animated.timing(knobLeft, {
      toValue: value ? KNOB_ON : KNOB_OFF,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [value, knobLeft]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[
        styles.track,
        {
          backgroundColor: value ? colors.purple : 'transparent',
          borderColor: value ? colors.purple : colors.borderStrong,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.knob,
          { left: knobLeft, backgroundColor: value ? '#fff' : colors.textSecondary },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
  },
  knob: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});
