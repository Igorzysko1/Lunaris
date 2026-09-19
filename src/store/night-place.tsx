/**
 * Miejsce nocy — to, o którym mówi zakładka Noc. **Każda noc ma swoje.**
 *
 * Do tej pory aplikacja znała jedno „miejsce": punkt z GPS albo miejscowość
 * wybraną w ustawieniach. Werdykt „odpuść" znaczył wtedy „odpuść **tutaj**",
 * choć czterdzieści kilometrów dalej noc przechodziła progi. Teraz każda noc
 * bierze zwycięzcę własnego rankingu: dziś może wygrywać Pustynia Błędowska,
 * jutro Złoty Potok — i tak ma być, bo pogoda nie rozkłada się co noc tak samo.
 *
 * Dwa pojęcia zostają rozdzielone. **Twoja pozycja** (`useSettings().active`)
 * mówi, skąd liczy się dojazd, i sama staje w rankingu jak każda miejscówka.
 * **Miejsce nocy** mówi, o czym jest werdykt danej nocy: domyślnie zwycięzca
 * jej rankingu, a po przypięciu — wskazane ręcznie dla wszystkich nocy, bo
 * powody wyboru gorszego miejsca bywają pozaastronomiczne.
 *
 * Jeden dostawca na aplikację, bo przegląd miejscówek **pobiera** prognozy.
 * Dwa niezależne wywołania hooka oznaczałyby dwa żądania o te same dane —
 * a tak z jednego pobrania korzystają i Noc, i Gdzie.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { Coords } from '@/data/places';
import { useSiteReview } from '@/hooks/use-site-review';
import type { HorizonMask, HorizonOverride } from '@/lib/horizon';
import { nightLogId } from '@/lib/journal';
import type { NightWindow } from '@/lib/night-window';
import { bestOutlook, type NightReview } from '@/lib/site-review';
import type { NightSlice } from '@/lib/weather';
import { ACTIVE_SITE_ID, activeAsSite } from '@/lib/where-text';
import { useForecast } from '@/store/forecast';
import { useSettings } from '@/store/settings';

export type NightPlace = {
  id: string;
  label: string;
  coords: Coords;
  /** Jakość nieba policzona dla tego punktu, nie wpisana do katalogu. */
  bortle: number;
  walkMinutes: number;
  horizonMask: HorizonMask | null;
  horizonOverrides: HorizonOverride[];
  /** Noc, której dotyczy, z godzinami prognozy **tego** miejsca. */
  slice: NightSlice;
  /** Wskazane ręcznie, a nie przez ranking. */
  pinned: boolean;
};

type NightPlaceValue = {
  /** Miejsce każdej nocy po kolei, od dzisiejszej. */
  places: NightPlace[];
  /** Ranking na kolejne noce; zakładka Gdzie czyta go stąd, zamiast pobierać drugi raz. */
  reviews: NightReview[];
  review: ReturnType<typeof useSiteReview>;
  /** Przypięte miejsce; `null` — każda noc bierze zwycięzcę swojego rankingu. */
  pinnedId: string | null;
  /** Przypina miejsce po identyfikatorze; `null` oddaje wybór rankingowi. */
  choose: (id: string | null) => void;
};

const NightPlaceContext = createContext<NightPlaceValue | null>(null);

export function NightPlaceProvider({ children }: { children: ReactNode }) {
  const { active, config, placeId, nightPlaceId, setNightPlace } = useSettings();
  const { bundle } = useForecast();

  // Twoja pozycja staje w rankingu jak każda miejscówka — i może go wygrać.
  // Jej prognozę przynosi cykl dobowy Nocy, więc przegląd jej nie pobiera.
  // Gdy sama jest miejscówką z katalogu, nie dokładamy jej drugi raz: ranking
  // pokazałby wtedy to samo miejsce dwa razy, raz z każdego źródła prognozy.
  const activeIsSite = active.source === 'manual' && config.sites.some((s) => s.id === placeId);
  const extra = useMemo(
    () => (activeIsSite ? null : { site: activeAsSite(active), nights: bundle?.nights ?? null }),
    [activeIsSite, active, bundle],
  );
  const review = useSiteReview(config, extra);

  const value = useMemo<NightPlaceValue>(() => {
    // Godziny prognozy danego miejsca na daną noc. Noce łączymy po dacie
    // wieczoru, a nie po pozycji: listy nocy z różnych źródeł nie muszą
    // zaczynać się od tej samej.
    const sliceOf = (siteId: string, night: NightWindow) => {
      const slices = siteId === ACTIVE_SITE_ID ? bundle?.nights : review.forecasts.get(siteId);
      const key = nightLogId(night.from);
      return slices?.find((s) => nightLogId(s.night.from) === key) ?? null;
    };

    const ranked = review.reviews.flatMap((night): NightPlace[] => {
      const all = [...night.go, ...night.dominated, ...night.noGo];
      const pinned = nightPlaceId ? (all.find((o) => o.site.id === nightPlaceId) ?? null) : null;
      // Przypięte, o ile ma tej nocy prognozę; inaczej zwycięzca tej nocy —
      // lepiej pokazać najlepsze miejsce niż pustą noc.
      const chosen = pinned ?? bestOutlook(night);
      if (!chosen) return [];

      const slice = sliceOf(chosen.site.id, night.night);
      if (!slice) return [];

      return [
        {
          id: chosen.site.id,
          label: chosen.site.name,
          coords: { lat: chosen.site.lat, lon: chosen.site.lon },
          bortle: chosen.bortle,
          walkMinutes: chosen.site.walkMinutes,
          horizonMask: chosen.site.horizonMask,
          horizonOverrides: chosen.site.horizonOverrides,
          slice,
          pinned: pinned !== null,
        },
      ];
    });

    // Zanim ranking się policzy (pierwsze uruchomienie, brak sieci) zakładka
    // pokazuje to, co zawsze pokazywała: twoją pozycję z jej prognozą.
    const places =
      ranked.length > 0
        ? ranked
        : (bundle?.nights ?? []).map((slice): NightPlace => ({
            id: ACTIVE_SITE_ID,
            label: active.label,
            coords: active.coords,
            bortle: active.bortle,
            walkMinutes: active.walkMinutes,
            horizonMask: active.horizonMask,
            horizonOverrides: active.horizonOverrides,
            slice,
            pinned: false,
          }));

    return {
      places,
      reviews: review.reviews,
      review,
      pinnedId: nightPlaceId,
      choose: setNightPlace,
    };
  }, [review, nightPlaceId, active, bundle, setNightPlace]);

  return <NightPlaceContext.Provider value={value}>{children}</NightPlaceContext.Provider>;
}

export function useNightPlace(): NightPlaceValue {
  const ctx = useContext(NightPlaceContext);
  if (!ctx) throw new Error('useNightPlace must be used inside <NightPlaceProvider>');
  return ctx;
}
