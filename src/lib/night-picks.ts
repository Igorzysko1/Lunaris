/**
 * Cele dopisane ręcznie do planu nocy — „Dopisz do planu tej nocy" w panelu celu.
 *
 * Plan dobiera cele sam, z jasności i okna, i nie zna wyboru obserwatora. Ten
 * zapis jest tym wyborem: kilka identyfikatorów przy nocy. To nie dziennik —
 * wybór dotyczy nocy, która dopiero będzie, i po niej nic nie znaczy. Stąd inne
 * reguły: stare noce się wyrzuca, a nieczytelny zapis wraca do pustego, bo nie
 * ma w nim niczego, czego nie da się dotknąć drugi raz.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

import { nightLogId, parseNightId } from './journal.ts';

/** Identyfikator nocy (`RRRR-MM-DD`, jak w dzienniku) → cele w kolejności dopisania. */
export type NightPicks = Record<string, string[]>;

/** Ile dób wstecz wybór się trzyma — noc zapisuje się czasem dzień, dwa po powrocie. */
const KEEP_DAYS = 2;

/** Zapis z dysku; wszystko, co nie jest nocą z listą identyfikatorów, odpada. */
export function parseNightPicks(raw: string | null): NightPicks {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([nightId, ids]) => {
        if (!parseNightId(nightId) || !Array.isArray(ids)) return [];
        const clean = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
        return clean.length ? [[nightId, clean]] : [];
      }),
    );
  } catch {
    return {};
  }
}

export function picksFor(picks: NightPicks, nightId: string): string[] {
  return picks[nightId] ?? [];
}

/**
 * Dopisuje cel do planu nocy albo go z niego zdejmuje. Przy okazji wyrzuca
 * noce starsze niż `KEEP_DAYS` przed `today` — zapis nie rośnie przez sezon.
 */
export function togglePick(
  picks: NightPicks,
  nightId: string,
  targetId: string,
  today: Date,
): NightPicks {
  const current = picksFor(picks, nightId);
  const next = current.includes(targetId)
    ? current.filter((id) => id !== targetId)
    : [...current, targetId];

  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - KEEP_DAYS);
  const oldest = nightLogId(cutoff);

  return Object.fromEntries(
    Object.entries({ ...picks, [nightId]: next }).filter(
      ([id, ids]) => id >= oldest && ids.length > 0,
    ),
  );
}
