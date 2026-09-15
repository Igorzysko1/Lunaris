import { useMemo, useState } from 'react';

import { CONSTELLATIONS } from '@/data/constellations';
import { DEEP_SKY_OBJECTS, type DeepSkyObject } from '@/data/deep-sky';
import { useJournal } from '@/hooks/use-journal';
import { togglePlanPick, useNightPicks } from '@/hooks/use-night-picks';
import { describeHistory, historyOf, nightLogId } from '@/lib/journal';
import { picksFor } from '@/lib/night-picks';
import { currentNightWindow } from '@/lib/night-window';
import { profileLabel } from '@/lib/optics';
import {
  bestMonth,
  constellationOf,
  culminationAltitude,
  describeBestMonth,
  describeCulmination,
  describeFieldShare,
  describeLibraryReach,
  fieldShare,
  foldForSearch,
} from '@/lib/sky-library';
import { describeSize } from '@/lib/sky-text';
import { libraryReach } from '@/lib/sky-targets';
import { FIGURES, SEASON_ORDER } from '@/mock/constellation-figures';
import { useSettings } from '@/store/settings';

export type LibraryKind = 'all' | DeepSkyObject['kind'];

const KIND_SHORT: Record<DeepSkyObject['kind'], string> = {
  galaktyka: 'galaktyka',
  mgławica: 'mgławica',
  'gromada otwarta': 'gr. otwarta',
  'gromada kulista': 'gr. kulista',
};

const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');

/** Gwiazdozbiór każdego obiektu — z granic IAU, liczony raz na uruchomienie. */
const CONSTELLATION_OF = new Map(DEEP_SKY_OBJECTS.map((o) => [o.id, constellationOf(o)]));

/** Obiekty w zasięgu któregokolwiek zestawu pod niebem aktywnego miejsca. */
function useReachable(): Set<string> {
  const { active, config } = useSettings();

  return useMemo(
    () =>
      new Set(
        DEEP_SKY_OBJECTS.filter((o) =>
          config.opticsProfiles.some((p) => libraryReach(o, p.optics, active.bortle) === null),
        ).map((o) => o.id),
      ),
    [config.opticsProfiles, active.bortle],
  );
}

/** 12a: biblioteka celów — pełny katalog; „tylko w zasięgu" jest wyborem, nie domyślnym. */
export function useTargetLibrary(query: string, kind: LibraryKind, onlyReach: boolean) {
  const { active } = useSettings();
  const reachable = useReachable();
  const folded = foldForSearch(query.trim());

  const rows = DEEP_SKY_OBJECTS.flatMap((object) => {
    const constellation = CONSTELLATION_OF.get(object.id) ?? null;
    const text = foldForSearch(
      `${object.designation} ${object.name} ${object.kind} ${constellation?.name ?? ''}`,
    );
    const reach = reachable.has(object.id);

    if (kind !== 'all' && object.kind !== kind) return [];
    if (onlyReach && !reach) return [];
    if (folded && !text.includes(folded)) return [];

    return [
      {
        id: object.id,
        designation: object.designation,
        name: object.name,
        meta: [
          KIND_SHORT[object.kind],
          `${decimal(object.magnitude)} mag`,
          describeSize(object.sizeArcmin),
          constellation?.name,
        ]
          .filter(Boolean)
          .join(' · '),
        reach,
      },
    ];
  });

  return {
    rows,
    total: DEEP_SKY_OBJECTS.length,
    note: `Szukam po oznaczeniu, nazwie, typie i gwiazdozbiorze. Kropka: w zasięgu któregoś zestawu pod niebem Bortle ${active.bortle} — nie mówi o dzisiejszej nocy.`,
  };
}

/** 12a: profil celu w bibliotece. */
export function useTargetProfile(id: string) {
  const { active, config } = useSettings();
  const { journal } = useJournal();
  const picks = useNightPicks();
  const [now] = useState(() => new Date());

  const object = DEEP_SKY_OBJECTS.find((o) => o.id === id) ?? null;
  const month = useMemo(
    () => (object ? bestMonth(object.raHours, now.getFullYear()) : 0),
    [object, now],
  );

  if (!object) return { found: false } as const;

  const tonightId = nightLogId(currentNightWindow(now, active.coords).from);
  const constellation = CONSTELLATION_OF.get(object.id) ?? null;
  const profiles = config.opticsProfiles;
  const widest = profiles.reduce((a, b) => (b.optics.fieldOfView > a.optics.fieldOfView ? b : a));
  const share = fieldShare(object.sizeArcmin, widest.optics.fieldOfView);
  const distance =
    object.distanceLy >= 1_000_000
      ? `${decimal(object.distanceLy / 1_000_000, 2)} mln lat św.`
      : `${Math.round(object.distanceLy)} lat św.`;

  return {
    found: true,
    title: `${object.designation} ${object.name}`,
    subtitle: [
      object.kind,
      `${decimal(object.magnitude)} mag`,
      describeSize(object.sizeArcmin),
    ].join(' · '),
    reach: profiles.map((profile) => {
      const verdict = libraryReach(object, profile.optics, active.bortle);
      return {
        id: profile.id,
        label: profileLabel(profile),
        ok: verdict === null,
        why: describeLibraryReach(verdict, profile.optics, active.bortle),
      };
    }),
    reachNote: `Liczone dla nieba Bortle ${active.bortle} — ${active.label}.`,
    field: {
      share: Math.min(1, share),
      text: describeFieldShare(share, widest.optics.fieldOfView, profileLabel(widest)),
    },
    when: [
      describeBestMonth(month),
      describeCulmination(culminationAltitude(object.dec, active.coords.lat), active.label),
    ],
    constellation: constellation ? { id: constellation.id, name: constellation.name } : null,
    facts: [
      ['jasność wizualna', `${decimal(object.magnitude)} mag`],
      ['rozmiar kątowy', describeSize(object.sizeArcmin)],
      ['odległość', distance],
      ['współrzędne J2000', `RA ${decimal(object.raHours, 3)} h · dec ${decimal(object.dec, 2)}°`],
    ] as [string, string][],
    history: describeHistory(historyOf(journal).get(object.id)) ?? 'jeszcze nie widziany',
    picked: picksFor(picks, tonightId).includes(object.id),
    togglePick: () => void togglePlanPick(tonightId, object.id),
  } as const;
}

/** 8a: biblioteka gwiazdozbiorów — galeria sezonowa z szukaniem bez ogonków. */
export function useConstellationLibrary(query: string) {
  const folded = foldForSearch(query.trim());

  const groups = SEASON_ORDER.map(([label, ids]) => {
    const all = ids.flatMap((id) => {
      const entry = CONSTELLATIONS.find((c) => c.id === id);
      return entry ? [entry] : [];
    });
    const items = folded
      ? all.filter((c) => foldForSearch(`${c.name} ${c.latin} ${c.star}`).includes(folded))
      : all;

    return {
      label,
      total: all.length,
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        latin: c.latin,
        figure: FIGURES[c.id] ?? null,
      })),
    };
  }).filter((group) => group.items.length > 0);

  return {
    groups,
    shown: groups.reduce((sum, group) => sum + group.items.length, 0),
    total: CONSTELLATIONS.length,
    searching: folded.length > 0,
  };
}
