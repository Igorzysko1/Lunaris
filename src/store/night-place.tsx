/**
 * Miejsce nocy — to, o którym mówi cała zakładka Noc.
 *
 * Do tej pory aplikacja znała jedno „miejsce": punkt z GPS albo miejscowość
 * wybraną w ustawieniach. Werdykt „odpuść" znaczył wtedy „odpuść **tutaj**",
 * choć czterdzieści kilometrów dalej noc przechodziła progi — i trzeba było
 * o tym wiedzieć samemu, żeby zajrzeć do zakładki Gdzie. To nie jest odpowiedź
 * na pytanie „czy jechać", bo jechać właśnie się zamierza.
 *
 * Dlatego są teraz dwa pojęcia. **Twoja pozycja** (`useSettings().active`)
 * mówi, skąd liczy się dojazd i gdzie jesteś. **Miejsce nocy** mówi, o czym
 * jest werdykt: domyślnie najlepsze z rankingu, a po przypięciu — wskazane
 * ręcznie, bo powody wyboru gorszego miejsca bywają pozaastronomiczne.
 *
 * Jeden dostawca na aplikację, bo przegląd miejscówek **pobiera** prognozy.
 * Dwa niezależne wywołania hooka oznaczałyby dwa żądania o te same dane —
 * a tak z jednego pobrania korzystają i Noc, i Gdzie.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { Coords } from '@/data/places';
import { useSiteReview } from '@/hooks/use-site-review';
import type { HorizonMask, HorizonOverride } from '@/lib/horizon';
import { bestOutlook, type NightReview, type SiteOutlook } from '@/lib/site-review';
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
  /** Noce tego miejsca; `null`, dopóki nie ma dla niego prognozy. */
  nights: NightSlice[] | null;
  /** Wskazane ręcznie, a nie przez ranking. */
  pinned: boolean;
};

type NightPlaceValue = {
  place: NightPlace;
  /** Miejsca w kolejności rankingu na najbliższą noc — do wyboru w Nocy. */
  candidates: SiteOutlook[];
  /** Ranking na kolejne noce; zakładka Gdzie czyta go stąd, zamiast pobierać drugi raz. */
  reviews: NightReview[];
  review: ReturnType<typeof useSiteReview>;
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
    // Miejsce rozstrzyga ranking **najbliższej nocy**, a nie tej wybranej
    // w przełączniku: jedno miejsce na całą zakładkę jest zrozumiałe, a wynik
    // skaczący przy przewijaniu nocy — nie. Kto chce inaczej, przypina.
    const tonight = review.reviews[0] ?? null;
    const ranked = tonight ? [...tonight.go, ...tonight.dominated, ...tonight.noGo] : [];

    const pinned = nightPlaceId ? (ranked.find((o) => o.site.id === nightPlaceId) ?? null) : null;
    const chosen = pinned ?? (tonight ? bestOutlook(tonight) : null);

    const place: NightPlace = chosen
      ? {
          id: chosen.site.id,
          label: chosen.site.name,
          coords: { lat: chosen.site.lat, lon: chosen.site.lon },
          bortle: chosen.bortle,
          walkMinutes: chosen.site.walkMinutes,
          horizonMask: chosen.site.horizonMask,
          horizonOverrides: chosen.site.horizonOverrides,
          nights:
            chosen.site.id === ACTIVE_SITE_ID
              ? (bundle?.nights ?? null)
              : (review.forecasts.get(chosen.site.id) ?? null),
          pinned: pinned !== null,
        }
      : // Zanim ranking się policzy (pierwsze uruchomienie, brak sieci) zakładka
        // pokazuje to, co zawsze pokazywała: twoją pozycję z jej prognozą.
        {
          id: ACTIVE_SITE_ID,
          label: active.label,
          coords: active.coords,
          bortle: active.bortle,
          walkMinutes: active.walkMinutes,
          horizonMask: active.horizonMask,
          horizonOverrides: active.horizonOverrides,
          nights: bundle?.nights ?? null,
          pinned: false,
        };

    return {
      place,
      candidates: ranked,
      reviews: review.reviews,
      review,
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
