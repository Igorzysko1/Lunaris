import { useMemo, useState } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

/** Ile trzeba przeciągnąć, żeby przejść do sąsiedniej nocy. */
const SWIPE = 60;
/** Od jakiego przesunięcia ruch w ogóle uznajemy za poziomy. */
const INTENT = 12;
/** Za ile treść idzie za palcem, gdy obok jest noc — i gdy jej nie ma (opór krawędzi). */
const FOLLOW = 0.6;
const RESIST = 0.25;

/**
 * Przesunięcie palcem po zakładce Noc zmienia noc jak kartki w kalendarzu:
 * palec w lewo przyciąga następną noc z prawej, palec w prawo — poprzednią
 * z lewej. Na krawędzi (dziś przy ruchu w prawo, ostatnia noc przy ruchu
 * w lewo) treść ugina się pod palcem i odbija z powrotem, żeby było widać,
 * że gest zadziałał, tylko dalej nic nie ma.
 *
 * Gest przejmujemy dopiero wtedy, gdy ruch jest wyraźnie poziomy — inaczej
 * zabierałby przewijanie w pionie, a zakładka przewija się prawie zawsze.
 * Strzałki w przełączniku zostają: czytnik ekranu gestu nie wykona.
 */
export function useNightSwipe(index: number, count: number, onChange: (index: number) => void) {
  const [shift] = useState(() => new Animated.Value(0));

  // Obsługa gestu powstaje od nowa, gdy zmieni się noc albo ich liczba — a to
  // dzieje się dopiero po skończonym geście, więc żaden gest nie traci
  // obsługi w połowie ruchu.
  const responder = useMemo(() => {
    const neighbour = (dx: number) => {
      // Palec w lewo odsłania to, co stoi na prawo — czyli późniejszą noc.
      const target = index + (dx < 0 ? 1 : -1);
      return target >= 0 && target < count ? target : null;
    };

    const settle = () =>
      Animated.spring(shift, { toValue: 0, bounciness: 8, useNativeDriver: true }).start();

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > INTENT && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        shift.setValue(g.dx * (neighbour(g.dx) === null ? RESIST : FOLLOW));
      },
      onPanResponderRelease: (_, g) => {
        const target = neighbour(g.dx);
        if (Math.abs(g.dx) < SWIPE || target === null) {
          settle();
          return;
        }

        // Stara noc odjeżdża w stronę ruchu palca, nowa wjeżdża z przeciwnej —
        // tak jak przy przesuwaniu kartki, a nie przeskok z miejsca.
        const width = Dimensions.get('window').width;
        const side = Math.sign(g.dx);
        Animated.timing(shift, {
          toValue: side * width * 0.35,
          duration: 110,
          useNativeDriver: true,
        }).start(() => {
          onChange(target);
          shift.setValue(-side * width * 0.25);
          settle();
        });
      },
      onPanResponderTerminate: settle,
    });
  }, [index, count, onChange, shift]);

  return { panHandlers: responder.panHandlers, style: { transform: [{ translateX: shift }] } };
}
