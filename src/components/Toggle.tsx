import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { colors } from '@/theme';

const KNOB_OFF = 3;
const KNOB_ON = 21;

/**
 * `label` jest wymagana, bo bez niej czytnik ekranu ogłasza „przełącznik,
 * włączony" i nic więcej. Widzący czyta podpis stojący obok w wierszu; czytnik
 * traktuje przełącznik jako osobny element i tamtego podpisu do niego nie
 * dołączy. Wymuszenie typem, a nie zaleceniem w komentarzu — kolejny wywołujący
 * nie ma jak o niej zapomnieć.
 */
export function Toggle({
  value,
  onPress,
  label,
}: {
  value: boolean;
  onPress: () => void;
  label: string;
}) {
  const [knobLeft] = useState(() => new Animated.Value(value ? KNOB_ON : KNOB_OFF));

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
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      // Sam tor ma 44×26 pt, czyli mniej niż wymagane 44 w pionie. Zapas
      // dobieramy powiększeniem obszaru dotyku, a nie samego elementu: przycisk
      // ma zostać tej wielkości, co reszta wiersza.
      hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
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
