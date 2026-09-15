import { useMemo } from 'react';

import { formatTime } from '@/lib/date';
import { moonAt } from '@/lib/moon';
import { nightConditions, seeingProfile } from '@/lib/night-conditions';
import { profileLabel } from '@/lib/optics';
import { describeSeeing } from '@/lib/seeing';
import { describeDew, moonEventTonight, type Narration } from '@/lib/session-text';
import type { NightCard } from '@/hooks/use-night-verdicts';
import { useSettings } from '@/store/settings';

/** Co trzecia godzina podpisana — przy kilkunastu słupkach więcej się nie zmieści. */
const AXIS_EVERY = 3;

export type ConditionsView = {
  clouds: {
    values: number[];
    highlight: [number, number] | null;
    axis: { slot: number; label: string }[];
    threshold: number;
    /** „min. 5% o 00:00" */
    lowest: string | undefined;
  } | null;
  /** Wilgotność, punkt rosy, opady — etykieta i wartość. */
  humidity: [string, string][];
  dew: Narration | null;
  /** Szkło zaparuje w ocenianych godzinach — ton uwagi pod wilgotnością. */
  dewWarn: boolean;
  /** Zachód, ciemno, świt astronomiczny, wschód. */
  astro: [string, string][];
  moon: { title: string; subtitle: string; date: string };
  /** Tylko wtedy, gdy seeing może ograniczyć któryś zestaw — patrz `seeingProfile`. */
  seeing: { score: string; detail: string; profile: string } | null;
  /** „chmury 25% · rosa 2 K" — bieżące progi w drugiej linijce wiersza. */
  thresholds: string;
};

const decimal = (value: number) => value.toFixed(1).replace('.', ',');
const plain = (value: number) => (Number.isInteger(value) ? String(value) : decimal(value));
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const hourOf = (date: Date) => String(date.getHours()).padStart(2, '0');

/**
 * Noc › Warunki dla wybranej nocy: to, z czego wynika werdykt nad segmentami.
 * Liczby przychodzą z `night-conditions` i `night-summary`, zdania z `session-text`.
 */
export function useNightConditions(card: NightCard): ConditionsView {
  const { active, config } = useSettings();
  const { lat, lon } = active.coords;

  return useMemo(() => {
    const conditions = nightConditions(card.slice, card.session.verdict, config);
    const { axis, dark, moon } = card.summary;
    const phase = moonAt(dark.from, lat, lon);
    const profile = seeingProfile(config.opticsProfiles);
    const seeing = card.session.seeing;

    return {
      clouds: conditions.hours.length
        ? {
            values: conditions.hours.map((h) => h.cloud),
            highlight: conditions.window,
            axis: conditions.hours.flatMap((h, slot) =>
              slot % AXIS_EVERY === 0 ? [{ slot, label: hourOf(h.at) }] : [],
            ),
            threshold: config.conditions.maxCloudTotal,
            lowest: conditions.lowestCloud
              ? `min. ${conditions.lowestCloud.percent}% o ${formatTime(conditions.lowestCloud.at)}`
              : undefined,
          }
        : null,
      humidity: [
        ['wilgotność', conditions.humidity === null ? '—' : `${conditions.humidity}%`],
        ['punkt rosy', conditions.dewPoint === null ? '—' : `${decimal(conditions.dewPoint)} °C`],
        ['opady', `${decimal(conditions.precipitation)} mm`],
      ],
      dew: describeDew(conditions),
      dewWarn: conditions.dewFrom !== null,
      astro: [
        ['zachód', formatTime(axis.from)],
        ['ciemno', formatTime(dark.from)],
        ['świt astr.', formatTime(dark.to)],
        ['wschód', formatTime(axis.to)],
      ],
      moon: {
        title: `${phase.name} · ${moon.illumination}%`,
        subtitle: [moonEventTonight(moon), lowerFirst(phase.detail)].filter(Boolean).join(' · '),
        date: dark.from.toISOString(),
      },
      seeing:
        profile && seeing
          ? {
              score: `${seeing.index}/5 · ${seeing.label}`,
              detail: describeSeeing(seeing),
              profile: profileLabel(profile),
            }
          : null,
      thresholds: `chmury ${config.conditions.maxCloudTotal}% · rosa ${plain(config.conditions.dewWarningSpreadC)} K`,
    };
  }, [card, config, lat, lon]);
}
