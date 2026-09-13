import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { colors } from '@/theme';

/** Droga gałki: od 3 do 21 pt wewnątrz toru. */
const KNOB_TRAVEL = 18;
const DURATION_MS = 180;

function slide(progress: Animated.Value, on: boolean) {
  Animated.timing(progress, {
    toValue: on ? 1 : 0,
    duration: DURATION_MS,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start();
}

/**
 * Przełącznik, który reaguje od razu, nawet gdy zmiana ustawienia jest ciężka.
 *
 * Wcześniejsza wersja zacinała się z dwóch powodów naraz. Animowała `left`,
 * czyli na wątku JavaScript, a ruszała dopiero po zmianie `value` — więc po
 * przeliczeniu całego ekranu, bo przełączenie kalendarza przelicza werdykty
 * i pobiera poranki od nowa. Teraz ruch jest wyłącznie `transform` i `opacity`
 * na wątku natywnym, startuje w chwili dotknięcia, a `onPress` dostaje się
 * dopiero po animacji, kiedy przeliczenie niczego już nie zatrzyma.
 *
 * Skoro gałka przesuwa się przed decyzją rodzica, rodzic nie może zmiany
 * odrzucić — przełączenie, którego nie wolno wykonać, ma przyjść jako
 * `disabled`. Gdyby jednak `value` się nie zmieniło, gałka wraca na miejsce.
 *
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
  disabled = false,
}: {
  value: boolean;
  onPress: () => void;
  label: string;
  disabled?: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));
  const [knobShift] = useState(() =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [0, KNOB_TRAVEL] }),
  );

  /** Stan, do którego gałka właśnie jedzie. */
  const target = useRef(value);
  /** Przełączenie pokazane, ale jeszcze nieprzekazane rodzicowi. */
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestOnPress = useRef(onPress);

  useEffect(() => {
    latestOnPress.current = onPress;
  }, [onPress]);

  // Zmiana z zewnątrz albo odpowiedź rodzica na własne przełączenie: gałka
  // dogania `value`. Póki własne przełączenie czeka, `value` jest jeszcze stare
  // i nie może cofnąć gałki w połowie drogi.
  useEffect(() => {
    if (pending.current) return;
    target.current = value;
    slide(progress, value);
  }, [value, progress]);

  // Zejście z ekranu w trakcie animacji nie może zgubić przełączenia.
  useEffect(() => {
    const timers = pending;
    const handler = latestOnPress;
    return () => {
      if (timers.current) {
        clearTimeout(timers.current);
        timers.current = null;
        handler.current();
      }
    };
  }, []);

  const press = () => {
    if (disabled) return;

    const next = !target.current;
    target.current = next;
    slide(progress, next);

    // Drugie dotknięcie przed końcem animacji znosi pierwsze. Wysłanie obu
    // zmieniłoby ustawienie dwa razy według tej samej, starej wartości — i
    // skończyło na odwrót, niż pokazuje gałka.
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = null;
      return;
    }

    pending.current = setTimeout(() => {
      pending.current = null;
      latestOnPress.current();
    }, DURATION_MS);
  };

  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      // Sam tor ma 44×26 pt, czyli mniej niż wymagane 44 w pionie. Zapas
      // dobieramy powiększeniem obszaru dotyku, a nie samego elementu: przycisk
      // ma zostać tej wielkości, co reszta wiersza.
      hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
      style={[styles.track, disabled && styles.disabled]}
    >
      {/* Kolor włączenia to warstwa przenikana przezroczystością — sam
          `backgroundColor` nie da się animować na wątku natywnym. */}
      <Animated.View pointerEvents="none" style={[styles.fill, { opacity: progress }]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.knob, { transform: [{ translateX: knobShift }] }]}
      >
        <Animated.View style={[styles.knobOn, { opacity: progress }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  disabled: {
    opacity: 0.6,
  },
  fill: {
    position: 'absolute',
    // Wystaje o grubość obrysu, żeby włączony tor był jednolicie fioletowy.
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 13,
    backgroundColor: colors.purple,
  },
  knob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.textSecondary,
  },
  knobOn: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
});
