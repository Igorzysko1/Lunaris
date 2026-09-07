/**
 * Przegląd katalogu miejscówek: gdzie tej nocy w ogóle warto pojechać.
 *
 * Silnik sesji odpowiada na pytanie „czy jechać **tam**". Tutaj zadajemy je dla
 * każdego miejsca z katalogu naraz i układamy odpowiedzi w ranking — bo pytanie,
 * które pada wieczorem, brzmi „gdzie", a nie „czy do tego jednego punktu".
 *
 * Miejsca dzielą dziesiątki kilometrów, więc każde ma własną prognozę, własne
 * okno nocy, własne Bortle i własne dojście od parkingu. Nic z tego nie jest
 * wspólne i nic nie da się przybliżyć aktywną lokalizacją.
 *
 * Rachunek jest czysty: wchodzą prognozy i konfiguracja, wychodzi ranking.
 * Werdyktów nie zapisujemy nigdzie — zależą od progów, które użytkownik zmienia
 * w dowolnej chwili, więc liczą się przy każdym renderze.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import type { ObservingSite } from '../data/observing-sites.ts';
import type { Coords } from '../data/places.ts';
import { computeNightRating, distanceKm } from './astro.ts';
import type { LunarisConfig } from './config.ts';
import type { NightWindow } from './night-window.ts';
import { windLimitKmh } from './optics.ts';
import { evaluateNight, type NextDay, type NightVerdict } from './session-engine.ts';
import { nightTargetsForProfiles } from './sky-targets.ts';
import type { NightHour, NightSlice } from './weather.ts';

/** Ocena jednego miejsca na jedną noc. */
export type SiteOutlook = {
  site: ObservingSite;
  verdict: NightVerdict;
  /** Ocena nocy 0–100 dla tego miejsca — jakość samego nieba, bez dojazdu. */
  rating: number;
  /** Ocena po odjęciu kary za dojazd. To ona ustala kolejność. */
  score: number;
  distanceKm: number;
  travelMinutes: number;
  /**
   * Miejsce, które jest **jednocześnie bliżej i lepsze**. Gdy takie istnieje,
   * wybór tego miejsca nie ma żadnego uzasadnienia i można je złożyć — to jedyny
   * przypadek, w którym ranking decyduje za użytkownika.
   */
  dominatedBy: string | null;
  /**
   * Cele widoczne stąd i z żadnego lepiej ocenionego miejsca. Jedyny powód, dla
   * którego miejsce gorsze i dalsze wraca na listę: ciemniejsze niebo potrafi
   * pokazać obiekt, którego bliżej nie widać, a tego żadna ocena nie odda.
   */
  uniqueTargets: string[];
};

export type NightReview = {
  night: NightWindow;
  /**
   * Miejsca warte rozważenia — od najlepszego. To są **alternatywy do wyboru**,
   * a nie jedna odpowiedź: użytkownik ma widzieć, że coś jeszcze było dobre.
   */
  go: SiteOutlook[];
  /**
   * Miejsca zdominowane: bliżej i lepiej da się mieć gdzie indziej, a nic
   * wyjątkowego stąd nie widać. Do złożenia, nie do ukrycia.
   */
  dominated: SiteOutlook[];
  /** Miejsca odrzucone, z powodem z silnika. Kolejność jak wyżej. */
  noGo: SiteOutlook[];
  /** Miejsca, dla których nie mamy prognozy — ranking mówi o nich wprost. */
  missing: ObservingSite[];
};

export type ReviewInput = {
  sites: ObservingSite[];
  /**
   * Prognozy per miejsce, po `id`. Brak wpisu znaczy „nie pobrano" i takie
   * miejsce trafia do `missing` — częściowa odpowiedź jest stanem dopuszczalnym,
   * a nie powodem, żeby nie pokazać reszty.
   */
  forecasts: Map<string, NightSlice[]>;
  home: Coords | null;
  config: LunarisConfig;
  moon: (
    night: NightWindow,
    coords: Coords,
  ) => { illumination: number; upAt: (at: Date) => boolean };
  nextDay: (night: NightWindow) => NextDay;
};

/** Najłagodniejszy próg wiatru spośród zestawów — patrz useSessions. */
function windLimitFor(config: LunarisConfig): number {
  return Math.max(
    ...config.opticsProfiles.map((p) =>
      windLimitKmh(p.optics, {
        tripod: config.conditions.maxWindGustKmh,
        handheld: config.conditions.maxWindGustHandheldKmh,
      }),
    ),
  );
}

function ratingFor(hours: NightHour[], bortle: number, illumination: number): number {
  if (hours.length === 0) return 0;

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  return computeNightRating({
    avgCloud: avg(hours.map((h) => h.cloud)),
    avgHumidity: avg(hours.map((h) => h.humidity)),
    precipitation: hours.reduce((sum, h) => sum + h.precipitation, 0),
    moonIllumination: illumination,
    bortle,
  });
}

/**
 * Ranking miejsc na kolejne noce.
 *
 * Kolejność ustala ocena nocy **pomniejszona o karę za dojazd**, więc bliższa
 * miejscówka z gorszym niebem może wyprzedzić dalszą i lepszą. Obie liczby
 * zostają w wyniku osobno, żeby dało się pokazać, dlaczego tak wyszło —
 * sama pozycja na liście niczego nie tłumaczy.
 */
export function reviewNights(input: ReviewInput): NightReview[] {
  const { sites, forecasts, home, config } = input;
  const windLimit = windLimitFor(config);

  const withData = sites.filter((site) => (forecasts.get(site.id)?.length ?? 0) > 0);
  const missing = sites.filter((site) => !withData.includes(site));

  // Noce bierzemy z pierwszego miejsca, które ma dane: okna różnią się między
  // miejscami o minuty, a lista nocy ma być wspólna dla całego przeglądu.
  const nightCount = withData.length > 0 ? (forecasts.get(withData[0].id)?.length ?? 0) : 0;

  return Array.from({ length: nightCount }, (_, index) => {
    const outlooks = withData.flatMap((site): SiteOutlook[] => {
      const slice = forecasts.get(site.id)?.[index];
      if (!slice) return [];

      const coords = { lat: site.lat, lon: site.lon };
      const moon = input.moon(slice.night, coords);

      const verdict = evaluateNight({
        night: slice.night,
        hours: slice.hours,
        moon,
        target: coords,
        home,
        nextDay: input.nextDay(slice.night),
        // Kalendarz zjawisk nie jest wpięty w silnik — patrz useSessions.
        uniquePhenomenon: false,
        windLimitKmh: windLimit,
        walkMinutes: site.walkMinutes,
        config,
      });

      const km = home ? distanceKm(home, coords) : 0;
      const travelMinutes = verdict.plan?.travelMinutes ?? 0;
      const rating = ratingFor(slice.hours, site.bortle, moon.illumination);
      const penalty = (travelMinutes / 60) * config.conditions.travelPenaltyPerHour;

      return [
        {
          site,
          verdict,
          rating,
          score: rating - penalty,
          distanceKm: km,
          travelMinutes,
          dominatedBy: null,
          uniqueTargets: [],
        },
      ];
    });

    const byScore = (a: SiteOutlook, b: SiteOutlook) => b.score - a.score;
    const viable = outlooks.filter((o) => o.verdict.status === 'go').sort(byScore);
    const { go, dominated } = splitDominated(viable, config);

    return {
      night: outlooks[0]?.verdict.night ?? { from: new Date(), to: new Date() },
      go,
      dominated,
      noGo: outlooks.filter((o) => o.verdict.status === 'no-go').sort(byScore),
      missing,
    };
  });
}

/** Cele w zasięgu któregokolwiek zestawu, po identyfikatorze i nazwie. */
function targetsAt(outlook: SiteOutlook, config: LunarisConfig): Map<string, string> {
  const window = outlook.verdict.window;
  if (!window) return new Map();

  const coords = { lat: outlook.site.lat, lon: outlook.site.lon };
  const found = new Map<string, string>();

  for (const target of nightTargetsForProfiles(
    window,
    coords,
    config.opticsProfiles,
    outlook.site.bortle,
  )) {
    // Ten sam obiekt wraca raz na zestaw sprzętu — do porównania miejsc liczy się
    // tylko to, czy widać go w ogóle.
    if (target.visible) found.set(target.id, target.name);
  }

  return found;
}

/**
 * Rozdziela miejsca warte pokazania od tych, które można złożyć.
 *
 * Ranking sam z siebie niczego nie ukrywa: dwie dobre noce w dwóch miejscach to
 * dwie realne opcje i obie mają być widoczne z odległością i wynikiem. Złożyć
 * wolno wyłącznie miejsce **zdominowane** — takie, dla którego istnieje inne,
 * jednocześnie bliższe i lepiej oceniane. Wtedy nie ma czego rozważać.
 *
 * Wyjątek jest jeden i wynika z fizyki, nie z gustu: ciemniejsze niebo pokazuje
 * obiekty, których jaśniejsze nie pokaże, a tego ocena nocy nie widzi — liczy
 * chmury, wilgotność i Księżyc, nie zasięg sprzętu. Miejsce zdominowane, z którego
 * widać cel niedostępny nigdzie indziej, wraca więc na listę razem z powodem.
 */
function splitDominated(
  viable: SiteOutlook[],
  config: LunarisConfig,
): { go: SiteOutlook[]; dominated: SiteOutlook[] } {
  if (viable.length < 2) return { go: viable, dominated: [] };

  // „Nie dość, że dalej, to jeszcze słabiej" — obie rzeczy naraz, ostro.
  const isDominated = (o: SiteOutlook) =>
    viable.find(
      (other) => other !== o && other.distanceKm < o.distanceKm && other.rating > o.rating,
    ) ?? null;

  const suspects = new Map<SiteOutlook, SiteOutlook>();
  for (const outlook of viable) {
    const better = isDominated(outlook);
    if (better) suspects.set(outlook, better);
  }

  if (suspects.size === 0) return { go: viable, dominated: [] };

  // Cele liczymy dopiero tutaj: to najdroższa część rachunku, a potrzebna jest
  // wyłącznie wtedy, gdy w ogóle jest co składać.
  const shown = viable.filter((o) => !suspects.has(o));
  const reachable = new Set<string>();
  for (const outlook of shown) {
    for (const id of targetsAt(outlook, config).keys()) reachable.add(id);
  }

  const go: SiteOutlook[] = [];
  const dominated: SiteOutlook[] = [];

  for (const outlook of viable) {
    const better = suspects.get(outlook);
    if (!better) {
      go.push(outlook);
      continue;
    }

    const unique = [...targetsAt(outlook, config)]
      .filter(([id]) => !reachable.has(id))
      .map(([, name]) => name);

    if (unique.length > 0) {
      go.push({ ...outlook, uniqueTargets: unique });
    } else {
      dominated.push({ ...outlook, dominatedBy: better.site.name });
    }
  }

  return { go, dominated };
}

/**
 * Dlaczego to miejsce stoi tu, a nie wyżej — jednym zdaniem.
 *
 * Bez tego ranking jest listą nazw: widać kolejność, nie widać powodu, a powód
 * bywa nieoczywisty, gdy bliższe i gorsze wygrywa z dalszym i lepszym.
 */
export function explainScore(outlook: SiteOutlook, config: LunarisConfig): string {
  const penalty = Math.round(outlook.rating - outlook.score);
  const rating = `niebo ${Math.round(outlook.rating)}/100`;

  if (penalty <= 0 || config.conditions.travelPenaltyPerHour === 0) return rating;

  return `${rating}, minus ${penalty} za ${Math.round(outlook.travelMinutes)} min drogi`;
}
