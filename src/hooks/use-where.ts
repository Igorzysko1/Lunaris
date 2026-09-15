import { useMemo, useState } from 'react';
import { Linking } from 'react-native';

import { findPlaceById } from '@/data/places';
import { capturePosition, type PositionFix } from '@/hooks/use-device-location';
import { useNow } from '@/hooks/use-now';
import { useSiteReview } from '@/hooks/use-site-review';
import { distanceKm, formatDistance, ratingScore } from '@/lib/astro';
import type { LunarisConfig } from '@/lib/config';
import { formatTime } from '@/lib/date';
import { formatAge } from '@/lib/forecast-cache';
import { lightPollutionMapUrl } from '@/lib/light-pollution';
import { describeRejection, nightRelative } from '@/lib/session-text';
import { explainScore, type SiteOutlook } from '@/lib/site-review';
import { skyQualityAt } from '@/lib/sky-map';
import {
  ACTIVE_SITE_ID,
  activeAsSite,
  coordsText,
  dominatedText,
  driveMinutes,
  gpsAccuracyText,
  horizonSummary,
  missingAction,
  missingTitle,
  navigationUrl,
  nightChoice,
  obstacleText,
  parseObstacle,
  partialNote,
  rankingNote,
  shiftText,
  skyText,
  travelLong,
  travelShort,
  uniqueText,
  walkText,
  windowText,
} from '@/lib/where-text';
import { useForecast } from '@/store/forecast';
import { useSettings } from '@/store/settings';
import type { Tone } from '@/ui/kit';

/** Ile istniejących miejsc proponujemy do korekty współrzędnych — najbliższe fixowi. */
const NEARBY_SITES = 3;

/**
 * Ranking katalogu razem z miejscem wybranym w Nocy. Gdy wybrana jest
 * miejscówka z katalogu, stoi w rankingu jak każda inna, tylko oznaczona;
 * miejscowość albo GPS dochodzą jako osobny wiersz z prognozą cyklu Nocy.
 */
function useWhere() {
  const settings = useSettings();
  const { config, active, placeId } = settings;
  const { bundle } = useForecast();

  const activeIsSite = active.source === 'manual' && config.sites.some((s) => s.id === placeId);
  const extraSite = useMemo(
    () => (activeIsSite ? null : activeAsSite(active)),
    [activeIsSite, active],
  );
  const extra = useMemo(
    () => (extraSite ? { site: extraSite, nights: bundle?.nights ?? null } : null),
    [extraSite, bundle],
  );

  const review = useSiteReview(config, extra);
  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;

  return {
    ...review,
    settings,
    selectedId: activeIsSite ? placeId : ACTIVE_SITE_ID,
    home: homePlace
      ? { name: homePlace.name, coords: { lat: homePlace.lat, lon: homePlace.lon } }
      : null,
  };
}

export type RankRow = {
  id: string;
  name: string;
  /** Wiersz miejsca z Nocy spoza katalogu — nie ma arkusza miejscówki. */
  fromNight: boolean;
  /** To miejsce liczy teraz Noc. */
  selected: boolean;
  bortle: number;
  /** Wynik po karze za dojazd, 0–100 — to on ustala kolejność. */
  score: string;
  explain: string;
  verdict: string;
  window: string | null;
  travel: string | null;
  walk: string | null;
  walkWarn: boolean;
  unique: string | null;
  dominated: string | null;
  reason: string | null;
};

function rowOf(
  outlook: SiteOutlook,
  config: LunarisConfig,
  selectedId: string,
  hasHome: boolean,
): RankRow {
  const fromNight = outlook.site.id === ACTIVE_SITE_ID;
  const walk = walkText(outlook.site.walkMinutes, config.observer.walkToleranceMin);
  const { window, rejection } = outlook.verdict;

  return {
    id: outlook.site.id,
    name: outlook.site.name,
    fromNight,
    selected: outlook.site.id === selectedId,
    bortle: outlook.bortle,
    score: String(Math.round(outlook.score)),
    explain: explainScore(outlook, config),
    verdict: `JEDŹ · ${ratingScore(outlook.rating)}/5`,
    window: window ? windowText(window) : null,
    travel: hasHome ? travelShort(outlook.distanceKm, outlook.travelMinutes) : null,
    // Miejscowość nie zna dojścia od parkingu — „przy samochodzie" byłoby zmyśleniem.
    walk: fromNight ? null : walk.text,
    walkWarn: !fromNight && walk.warn,
    unique: outlook.uniqueTargets.length ? uniqueText(outlook.uniqueTargets) : null,
    dominated: outlook.dominatedBy ? dominatedText(outlook.dominatedBy) : null,
    reason: rejection ? describeRejection(rejection) : null,
  };
}

/** Gdzie › Ranking dla wybranej nocy (11a, 13c). */
export function useRanking(night: number) {
  const where = useWhere();
  const { config } = where.settings;
  const [opened] = useState(() => new Date());
  const now = useNow();

  const count = where.reviews.length;
  const index = count ? Math.min(night, count - 1) : 0;
  const review = where.reviews[index] ?? null;
  const row = (outlook: SiteOutlook) =>
    rowOf(outlook, config, where.selectedId, where.home !== null);

  const missing = review?.missing ?? [];
  const catalogMissing = missing.filter((site) => site.id !== ACTIVE_SITE_ID);
  const total = config.sites.length + (where.selectedId === ACTIVE_SITE_ID ? 1 : 0);
  const homeName = where.home?.name ?? null;
  const cooldown = where.cooldownUntil && where.cooldownUntil > now ? where.cooldownUntil : null;

  return {
    status: where.status,
    loading: where.status === 'loading' && review === null,
    nightIndex: index,
    nightCount: count,
    nightLabel: review ? nightChoice(nightRelative(review.night, opened)) : 'noc ▾',
    note: missing.length
      ? partialNote(total - missing.length, total, homeName)
      : rankingNote(homeName, config.conditions.travelPenaltyPerHour),
    go: review?.go.map(row) ?? [],
    dominated: review?.dominated.map(row) ?? [],
    noGo: review?.noGo.map(row) ?? [],
    nothingGoes: review !== null && review.go.length === 0 && review.noGo.length > 0,
    missing: missing.map((site) => ({
      id: site.id,
      name: site.name,
      distance: where.home ? formatDistance(distanceKm(where.home.coords, site)) : site.region,
    })),
    missingTitle: missingTitle(missing.length),
    /** Przycisk tylko dla katalogu — prognozę miejsca z Nocy pobiera cykl Nocy. */
    missingAction: catalogMissing.length ? missingAction(catalogMissing.length) : null,
    activeMissing: missing.some((site) => site.id === ACTIVE_SITE_ID),
    fetchMissing: () => void where.fetchMissing(catalogMissing),
    fetching: where.fetching,
    fetchFailed: where.fetchFailed,
    /** „spróbuję po 21:40" — po odpowiedzi 429 przycisk czeka pół godziny. */
    cooldown: cooldown ? `spróbuję po ${formatTime(cooldown)}` : null,
    stale: where.savedAt ? `Dane ${formatAge(where.savedAt, now)} — brak świeżej prognozy.` : null,
    refresh: where.refresh,
  };
}

export type RankingView = ReturnType<typeof useRanking>;

type Capture =
  | { state: 'idle' }
  | { state: 'locating' }
  | { state: 'failed'; reason: 'denied' | 'unavailable' }
  | { state: 'caught'; fix: PositionFix };

/** Gdzie › Katalog (11c): miejscówki z niebem i dojazdem oraz gest „Jestem tutaj". */
export function useSiteCatalog() {
  const { config, active, addSiteAt, moveSite, selectPlace } = useSettings();
  const [capture, setCapture] = useState<Capture>({ state: 'idle' });
  const [saved, setSaved] = useState<string | null>(null);

  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;
  const home = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;
  const { averageSpeedKmh, walkToleranceMin } = config.observer;

  const rows = config.sites.map((site) => {
    const sky = skyQualityAt(site.lat, site.lon, site.bortle);
    const km = home ? distanceKm(home, site) : null;
    const walk = walkText(site.walkMinutes, walkToleranceMin);

    return {
      id: site.id,
      name: site.name,
      bortle: sky.bortle,
      travel: km === null ? site.region : travelLong(km, driveMinutes(km, averageSpeedKmh)),
      walk: walk.text,
      walkWarn: walk.warn,
    };
  });

  const fix = capture.state === 'caught' ? capture.fix : null;
  const accuracy = fix ? gpsAccuracyText(fix.accuracyM) : null;

  async function locate() {
    setSaved(null);
    setCapture({ state: 'locating' });
    const result = await capturePosition();
    setCapture(
      result.ok ? { state: 'caught', fix: result.fix } : { state: 'failed', reason: result.reason },
    );
  }

  return {
    homeNote: homePlace
      ? `Dojazd z: ${homePlace.name}`
      : 'Ustaw punkt startowy, żeby zobaczyć dojazd',
    rows,
    locating: capture.state === 'locating',
    locateError:
      capture.state === 'failed'
        ? capture.reason === 'denied'
          ? 'Bez zgody na lokalizację nie odczytam pozycji.'
          : 'Nie udało się złapać pozycji. Spróbuj pod otwartym niebem.'
        : null,
    fix:
      fix && accuracy
        ? {
            coords: coordsText(fix.coords),
            accuracy: accuracy.text,
            weak: accuracy.warn,
            nearby: config.sites
              .map((site) => ({ id: site.id, name: site.name, km: distanceKm(site, fix.coords) }))
              .sort((a, b) => a.km - b.km)
              .slice(0, NEARBY_SITES)
              .map((site) => ({ id: site.id, name: site.name, distance: shiftText(site.km) })),
          }
        : null,
    saved,
    locate: () => void locate(),
    /** Zapisany punkt od razu staje się miejscem obserwacji — po to się go zapisuje, stojąc na nim. */
    saveNew: (name: string) => {
      if (!fix) return;
      const id = addSiteAt(name, fix.coords, fix.accuracyM);
      selectPlace(id);
      setSaved(`Zapisano „${name.trim() || 'Nowe miejsce'}” — Noc liczy teraz dla tego punktu.`);
      setCapture({ state: 'idle' });
    },
    overwrite: (id: string) => {
      if (!fix) return;
      moveSite(id, fix.coords, fix.accuracyM);
      setSaved(`Poprawiono współrzędne: ${config.sites.find((s) => s.id === id)?.name ?? id}.`);
      setCapture({ state: 'idle' });
    },
    cancel: () => setCapture({ state: 'idle' }),
    openLightMap: () =>
      void Linking.openURL(lightPollutionMapUrl(active.coords.lat, active.coords.lon)),
  };
}

/** Szczegół miejscówki (11b) dla nocy wybranej w rankingu. */
export function useSiteDetail(id: string, night: number) {
  const where = useWhere();
  const {
    config,
    placeId,
    active,
    selectPlace,
    removeSite,
    updateSiteNotes,
    addHorizonOverride,
    removeHorizonOverride,
  } = where.settings;

  const site = config.sites.find((s) => s.id === id) ?? null;
  const count = where.reviews.length;
  const review = count ? where.reviews[Math.min(night, count - 1)] : null;
  const rank = review ? review.go.findIndex((o) => o.site.id === id) : -1;
  const dominated = review?.dominated.find((o) => o.site.id === id) ?? null;
  const rejected = review?.noGo.find((o) => o.site.id === id) ?? null;
  const outlook = rank >= 0 ? review!.go[rank] : (dominated ?? rejected);
  const observing = active.source === 'manual' && placeId === id;

  const verdict: {
    tone: Tone;
    word: string;
    window: string | null;
    summary: string;
    explain: string | null;
  } =
    rank >= 0 && outlook
      ? {
          tone: 'go',
          word: `JEDŹ · ${ratingScore(outlook.rating)}/5`,
          window: outlook.verdict.window ? windowText(outlook.verdict.window) : null,
          summary: `${rank + 1}. miejsce w rankingu tej nocy:`,
          explain: explainScore(outlook, config),
        }
      : dominated
        ? {
            tone: 'neutral',
            word: 'ZDOMINOWANE',
            window: dominated.verdict.window ? windowText(dominated.verdict.window) : null,
            summary: dominatedText(dominated.dominatedBy ?? ''),
            explain: explainScore(dominated, config),
          }
        : rejected
          ? {
              tone: 'bad',
              word: 'ODPUŚĆ',
              window: null,
              summary: rejected.verdict.rejection
                ? describeRejection(rejected.verdict.rejection)
                : 'Brak okna.',
              explain: null,
            }
          : {
              tone: 'neutral',
              word: where.status === 'loading' ? 'LICZĘ' : 'BEZ PROGNOZY',
              window: null,
              summary:
                where.status === 'loading'
                  ? 'Liczę ranking miejscówek…'
                  : 'Tej nocy nie mam prognozy dla tego miejsca — pobierzesz ją w rankingu.',
              explain: null,
            };

  if (!site) return { site: null } as const;

  const home = where.home;
  const km = home ? distanceKm(home.coords, site) : null;
  const walk = walkText(site.walkMinutes, config.observer.walkToleranceMin);

  return {
    site,
    subtitle: [site.region, coordsText(site)].filter(Boolean).join(' · '),
    verdict,
    sky: skyText(skyQualityAt(site.lat, site.lon, site.bortle)),
    accuracy:
      site.accuracyM !== null
        ? `zapisane z terenu, dokładność ±${Math.round(site.accuracyM)} m`
        : null,
    travel:
      km === null
        ? 'Ustaw punkt startowy, żeby policzyć dojazd.'
        : travelLong(km, driveMinutes(km, config.observer.averageSpeedKmh)),
    travelNote: home
      ? `Dojazd z: ${home.name} — z odległości i średniej prędkości z profilu (${config.observer.averageSpeedKmh} km/h), nie zapisany przy miejscu.`
      : null,
    walk: walk.text,
    walkWarn: walk.warn,
    unique: outlook?.uniqueTargets.length
      ? outlook.uniqueTargets.map((name) => name.replace(' — ', ' ')).join(' · ')
      : null,
    horizon: horizonSummary(site.horizonMask),
    obstacles: site.horizonOverrides.map(obstacleText),
    notes: site.notes,
    observing,
    removeWarning: observing
      ? 'Zniknie z katalogu i z rankingu. Noc liczy teraz dla tego miejsca — wróci do domyślnej miejscowości.'
      : 'Zniknie z katalogu i z rankingu razem z notatkami i korektami horyzontu.',
    /** `false`, gdy wpis nie jest przeszkodą — azymuty 0–360, wysokość 0–90. */
    addObstacle: (from: string, to: string, altitude: string) => {
      const override = parseObstacle(from, to, altitude);
      if (override) addHorizonOverride(site.id, override);
      return override !== null;
    },
    removeObstacle: (index: number) => removeHorizonOverride(site.id, index),
    saveNotes: (text: string) => updateSiteNotes(site.id, text.trim()),
    observeHere: () => selectPlace(site.id),
    navigate: () => void Linking.openURL(navigationUrl(site)),
    remove: () => removeSite(site.id),
  };
}
