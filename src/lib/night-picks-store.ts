/**
 * Zapis celów dopisanych do planu nocy. Zasady zapisu są w `night-picks.ts`;
 * tu tylko dysk. Klucz poza prefiksem prognoz, bo `pruneExpired` nie ma go czyścić
 * razem z cache'em.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseNightPicks, type NightPicks } from './night-picks';

const PICKS_KEY = 'lunaris.night-picks';

export async function loadNightPicks(): Promise<NightPicks> {
  try {
    return parseNightPicks(await AsyncStorage.getItem(PICKS_KEY));
  } catch {
    return {};
  }
}

/** `false`, gdy zapis się nie udał — wybór nie może udawać, że został. */
export async function saveNightPicks(picks: NightPicks): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PICKS_KEY, JSON.stringify(picks));
    return true;
  } catch {
    return false;
  }
}
