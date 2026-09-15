import { useMemo, useState } from 'react';

import { DEEP_SKY_OBJECTS } from '@/data/deep-sky';
import { changeJournal, useJournal } from '@/hooks/use-journal';
import { togglePlanPick, useNightPicks } from '@/hooks/use-night-picks';
import { useNow } from '@/hooks/use-now';
import { formatNightSpan, formatTime } from '@/lib/date';
import { horizonOf } from '@/lib/horizon';
import {
  describeHistory,
  historyOf,
  nightLogId,
  parseNightId,
  withSighting,
  withoutSighting,
  type Journal,
} from '@/lib/journal';
import { sightingsOf } from '@/lib/journal-text';
import { picksFor } from '@/lib/night-picks';
import {
  checkOffOpen,
  fullHours,
  isFirstTime,
  minutesOf,
  overlapOf,
  slotsWithin,
} from '@/lib/night-sky';
import { moonOverNight, nightBar, positionOnAxis, sunAxis } from '@/lib/night-summary';
import { currentNightWindow, nightWindow, type NightWindow } from '@/lib/night-window';
import { profileLabel } from '@/lib/optics';
import { formatDuration } from '@/lib/session-text';
import {
  describeAzimuth,
  describeOpticsReach,
  describeShortOverlap,
  describeSize,
  seenTitle,
} from '@/lib/sky-text';
import { altitudesOf, describeOutOfReach, targetLabel, targetTonight } from '@/lib/sky-targets';
import { useSettings } from '@/store/settings';

/** Co trzecia godzina podpisana pod profilem wysokości — jak pod zachmurzeniem. */
const AXIS_EVERY = 3;

export type TargetPanelParams = {
  id: string;
  /** Noc jak w dzienniku; bez niej — noc bieżąca. */
  night?: string;
  profile?: string;
  /** Okno sesji w ISO, gdy noc je ma. */
  from?: string;
  to?: string;
};

const dateOf = (iso: string | undefined) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

/**
 * Panel celu — „czy dziś i o której". Cel liczy się sam, dla nocy i zestawu,
 * z których przyszedł z listy; historia i odhaczenie idą z dziennika.
 */
export function useTargetPanel(params: TargetPanelParams) {
  const { active, config } = useSettings();
  const { journal, readable } = useJournal();
  const picks = useNightPicks();
  const now = useNow();
  const [opened] = useState(() => new Date());
  const [saveFailed, setSaveFailed] = useState(false);
  const { lat, lon } = active.coords;
  const { id } = params;

  const dark = useMemo(() => {
    const evening = params.night ? parseNightId(params.night) : null;
    return evening ? nightWindow(evening, { lat, lon }) : currentNightWindow(opened, { lat, lon });
  }, [params.night, lat, lon, opened]);

  const { axis, moon } = useMemo(() => {
    const sun = sunAxis(dark, { lat, lon });
    return { axis: sun, moon: moonOverNight(sun, { lat, lon }, dark.from) };
  }, [dark, lat, lon]);

  const session = useMemo<NightWindow | null>(() => {
    const from = dateOf(params.from);
    const to = dateOf(params.to);
    return from && to && from < to ? { from, to } : null;
  }, [params.from, params.to]);

  const entries = useMemo(
    () =>
      targetTonight(
        id,
        dark,
        { lat, lon },
        config.opticsProfiles,
        active.bortle,
        horizonOf(active.horizonMask, active.horizonOverrides),
      ),
    [
      id,
      dark,
      lat,
      lon,
      config.opticsProfiles,
      active.bortle,
      active.horizonMask,
      active.horizonOverrides,
    ],
  );

  const hours = useMemo(() => fullHours(dark), [dark]);
  const altitudes = useMemo(() => altitudesOf(id, hours, { lat, lon }), [id, hours, lat, lon]);

  const target =
    entries.find((t) => t.profileId === params.profile) ??
    entries.find((t) => t.visible) ??
    entries[0] ??
    null;

  const logId = nightLogId(dark.from);
  const observation = journal.logs
    .find((log) => log.id === logId)
    ?.observations.find((o) => o.targetId === id);
  const history = historyOf(journal).get(id);
  const profile = config.opticsProfiles.find((p) => p.id === target?.profileId) ?? null;
  const dso = DEEP_SKY_OBJECTS.find((o) => o.id === id);

  const visible = target?.up ? overlapOf(target.up, dark) : null;
  const inWindow = session && target ? overlapOf(target.up, session) : null;

  async function save(change: (journal: Journal) => Journal) {
    setSaveFailed((await changeJournal(change)) === null);
  }

  function mark() {
    if (!target) return;
    const at = new Date().toISOString();

    void save((current) =>
      withSighting(
        current,
        {
          id: logId,
          nightFrom: dark.from.toISOString(),
          siteId: config.sites.find((s) => s.name === active.label)?.id ?? null,
          siteName: active.label,
        },
        {
          targetId: id,
          outcome: 'seen',
          conditions: {
            bortle: active.bortle,
            altitude: target.maxAltitude,
            moonIllumination: moon.illumination,
          },
          profileId: target.profileId,
          seenAt: at,
        },
        at,
      ),
    );
  }

  return {
    found: target !== null,
    name: target ? target.name.replace(' — ', ' ') : targetLabel(id),
    meta: target
      ? [target.detail, dso ? describeSize(dso.sizeArcmin) : null].filter(Boolean).join(' · ')
      : '',
    firstTime: target ? isFirstTime(target, history, journal) : false,
    picked: picksFor(picks, logId).includes(id),
    outOfReach:
      target && !target.visible
        ? `Tym zestawem poza zasięgiem: ${describeOutOfReach(target)}.`
        : null,
    /** Od zachodu do wschodu Słońca tej nocy. */
    checkOffOpen: checkOffOpen(axis, now),
    /** Czy to noc, która trwa albo zaraz się zacznie — dla przełącznika makiety. */
    currentNight: logId === nightLogId(currentNightWindow(now, { lat, lon }).from),
    seen: observation?.outcome === 'seen' ? seenTitle(observation.seenAt) : null,
    failed:
      observation?.outcome === 'failed'
        ? `w zapisie tej nocy: nie wyszło${observation.reason ? ` — ${observation.reason}` : ''}`
        : null,
    nightSpan: formatNightSpan(dark.from, dark.to),
    readable,
    saveFailed,
    visibility: !visible
      ? 'nie wychodzi nad horyzont'
      : session
        ? `${formatDuration(minutesOf(inWindow))} w oknie`
        : `${formatDuration(minutesOf(visible))} po zmroku`,
    bar: nightBar({ axis, dark, moon }, visible ?? { from: dark.from, to: dark.from }),
    nowOnBar: positionOnAxis(axis, now),
    overlapWarning: session && target ? describeShortOverlap(target.up, session) : null,
    altitude:
      target && altitudes
        ? {
            values: altitudes.map((value) => Math.max(0, value)),
            highlight: slotsWithin(hours, session ?? visible),
            axis: hours.flatMap((hour, slot) =>
              slot % AXIS_EVERY === 0
                ? [{ slot, label: String(hour.getHours()).padStart(2, '0') }]
                : [],
            ),
            highest: `${Math.round(target.maxAltitude)}°`,
            highestAt: formatTime(target.bestAt),
            azimuth: describeAzimuth(target.bestAzimuth),
          }
        : null,
    historySummary: describeHistory(history) ?? '',
    sightings: sightingsOf(journal, id),
    optics: profile
      ? { label: profileLabel(profile), detail: describeOpticsReach(profile.optics) }
      : null,
    mark,
    unmark: () => void save((current) => withoutSighting(current, logId, id)),
    togglePick: () => void togglePlanPick(logId, id),
  };
}
