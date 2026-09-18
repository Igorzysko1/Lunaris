import { useMemo } from 'react';

import { CONSTELLATIONS } from '@/data/constellations';
import { DEEP_SKY_OBJECTS } from '@/data/deep-sky';
import { useJournal } from '@/hooks/use-journal';
import { useNightPicks } from '@/hooks/use-night-picks';
import type { NightCard } from '@/hooks/use-night-verdicts';
import { useNow } from '@/hooks/use-now';
import { constellationsTonight } from '@/lib/constellations';
import { formatTime } from '@/lib/date';
import { horizonOf } from '@/lib/horizon';
import { historyOf, nightLogId } from '@/lib/journal';
import { picksFor } from '@/lib/night-picks';
import { isFirstTime, outOfReach, skyList } from '@/lib/night-sky';
import { profileLabel } from '@/lib/optics';
import { describeSettingSoon, describeUpSpan, outOfReachTitle } from '@/lib/sky-text';
import { describeOutOfReach, nightTargetsForProfiles } from '@/lib/sky-targets';
import { useNightPlace } from '@/store/night-place';
import { useSettings } from '@/store/settings';

/** Ile gwiazdozbiorów w żetonach — dalej to już lista, a ta jest w bibliotece. */
const CONSTELLATION_CHIPS = 8;

/** Ile celów poza zasięgiem rozwija się pod wierszem; resztę pokazuje Biblioteka celów. */
const OUT_OF_REACH_SHOWN = 12;

const shortName = (name: string) => name.replace(' — ', ' ');

export type SkyTargetRow = {
  id: string;
  name: string;
  /** „gromada kulista, 5.8 mag" — z dopiskiem, gdy cel jest w planie albo już widziany. */
  meta: string;
  /** „do 01:05", „od 23:30", „całe okno" */
  window: string;
  altitude: number;
  urgent: boolean;
  firstTime: boolean;
  /** „widziany 23:04" — stan po odhaczeniu w panelu celu; `null`, gdy jeszcze nie. */
  seen: string | null;
  /** Sama godzina odhaczenia — do listy odhaczeń w nocy w trakcie. */
  seenTime: string | null;
  /** „zachodzi za 2 h 01 min — teraz albo nigdy"; tylko przy celu jeszcze nieodhaczonym. */
  setsSoon: string | null;
};

export type SkyView = {
  /** Identyfikator nocy jak w dzienniku — do panelu celu i planu nocy. */
  nightId: string;
  /** Okno sesji w ISO; `null` przy „odpuść". */
  window: { from: string; to: string } | null;
  profiles: { id: string; label: string }[];
  profile: { id: string; label: string };
  /** Zestaw po dotknięciu „zmień". */
  nextProfileId: string;
  targets: SkyTargetRow[];
  /** „2 z 5 odhaczone w panelach celów" */
  checked: string;
  outOfReach: {
    title: string;
    rows: { id: string; name: string; why: string }[];
    /** Ilu nie pokazano pod wierszem. */
    more: number;
  };
  constellations: { id: string; label: string; altitude: number }[];
  libraryTargets: number;
  libraryConstellations: number;
};

/**
 * Noc › Niebo dla wybranej nocy i zestawu. Cele liczą się w oknie sesji, a przy
 * „odpuść" w całej nocy astronomicznej — tak, jak `planNights` liczy cele
 * rezerwacji, tyle że z maską horyzontu miejsca. `enabled` odkłada efemerydy do
 * pierwszego wejścia w Niebo albo Plan.
 */
export function useNightSky(card: NightCard, profileId: string | null, enabled: boolean): SkyView {
  const { config } = useSettings();
  // Cele liczą się dla miejsca nocy: jego nieba, jego horyzontu. Werdykt
  // o Złotym Potoku z listą celów widzianych z Jaworzna byłby sklejką.
  const { place } = useNightPlace();
  const { journal } = useJournal();
  const picks = useNightPicks();
  const now = useNow();
  const { lat, lon } = place.coords;

  const session = card.session.verdict.window;
  const dark = card.summary.dark;
  const from = (session ?? dark).from.getTime();
  const to = (session ?? dark).to.getTime();
  const nightId = nightLogId(dark.from);

  const targets = useMemo(
    () =>
      enabled
        ? nightTargetsForProfiles(
            { from: new Date(from), to: new Date(to) },
            { lat, lon },
            config.opticsProfiles,
            place.bortle,
            horizonOf(place.horizonMask, place.horizonOverrides),
          )
        : [],
    [
      enabled,
      from,
      to,
      lat,
      lon,
      config.opticsProfiles,
      place.bortle,
      place.horizonMask,
      place.horizonOverrides,
    ],
  );

  const constellations = useMemo(
    () => (enabled ? constellationsTonight(dark, { lat, lon }).slice(0, CONSTELLATION_CHIPS) : []),
    [enabled, dark, lat, lon],
  );

  const history = useMemo(() => historyOf(journal), [journal]);

  const profiles = config.opticsProfiles.map((p) => ({ id: p.id, label: profileLabel(p) }));
  const current = profiles.find((p) => p.id === profileId) ?? profiles[0] ?? { id: '', label: '—' };
  const next = profiles[(profiles.indexOf(current) + 1) % Math.max(1, profiles.length)] ?? current;

  const span = { from: new Date(from), to: new Date(to) };
  const rows = skyList(targets, current.id, span, picksFor(picks, nightId));
  const out = outOfReach(targets, current.id);

  // Odhacza się tylko w panelu celu — lista pokazuje stan po fakcie.
  const tonight = journal.logs.find((log) => log.id === nightId);
  const seenOf = (id: string) => {
    const seen = tonight?.observations.find((o) => o.targetId === id && o.outcome === 'seen');
    if (!seen) return null;
    const time = seen.seenAt ? formatTime(new Date(seen.seenAt)) : null;
    return { time, label: time ? `widziany ${time}` : 'widziany' };
  };

  return {
    nightId,
    window: session ? { from: session.from.toISOString(), to: session.to.toISOString() } : null,
    profiles,
    profile: current,
    nextProfileId: next.id,
    targets: rows.map(({ target, urgent, picked }) => {
      const seen = seenOf(target.id);
      return {
        id: target.id,
        name: shortName(target.name),
        meta: [target.detail, picked ? 'w planie' : null, seen?.label].filter(Boolean).join(' · '),
        seen: seen?.label ?? null,
        seenTime: seen?.time ?? null,
        setsSoon: seen ? null : describeSettingSoon(target.up, now),
        window: describeUpSpan(target.up),
        altitude: Math.round(target.maxAltitude),
        urgent,
        firstTime: isFirstTime(target, history.get(target.id), journal),
      };
    }),
    checked: `${rows.filter((row) => seenOf(row.target.id)).length} z ${rows.length} odhaczone w panelach celów`,
    outOfReach: {
      title: outOfReachTitle(out.length, current.label),
      rows: out.slice(0, OUT_OF_REACH_SHOWN).map((target) => ({
        id: target.id,
        name: shortName(target.name),
        why: describeOutOfReach(target),
      })),
      more: Math.max(0, out.length - OUT_OF_REACH_SHOWN),
    },
    constellations: constellations.map((entry) => ({
      id: entry.constellation.id,
      label: entry.constellation.latin,
      altitude: Math.round(entry.maxAltitude),
    })),
    libraryTargets: DEEP_SKY_OBJECTS.length,
    libraryConstellations: CONSTELLATIONS.length,
  };
}
