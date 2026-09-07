/**
 * Zapis dziennika na dysku — trzecia kategoria pamięci w tej aplikacji.
 *
 * Dwie dotychczasowe mają reguły, które tutaj byłyby katastrofą:
 * `settings-storage.ts` po nieudanym odczycie wraca do wartości domyślnych,
 * a `forecast-cache.ts` z założenia wyrzuca to, co się przeterminowało. Dziennik
 * jest przyrostowy i nieodtwarzalny — nie wolno go eksmitować przy sprzątaniu
 * cache'u ani zresetować po nieudanej migracji.
 *
 * Stąd osobny klucz (`lunaris.journal`, poza prefiksem, który czyści
 * `pruneExpired`), własna reguła odczytu i eksport do pliku od pierwszej wersji.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import {
  EMPTY_JOURNAL,
  exportJournal,
  parseJournal,
  upsertLog,
  type Journal,
  type NightLog,
} from './journal';

const JOURNAL_KEY = 'lunaris.journal';

/**
 * Wczytuje dziennik. Pusty dziennik i dziennik nieczytelny to dwie różne
 * rzeczy — patrz `readable`. Wywołujący nie może nadpisać tego drugiego.
 */
export async function loadJournal(): Promise<{ journal: Journal; readable: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(JOURNAL_KEY);
    if (raw === null) return { journal: EMPTY_JOURNAL, readable: true };

    const parsed = parseJournal(raw);
    return parsed
      ? { journal: parsed, readable: true }
      : { journal: EMPTY_JOURNAL, readable: false };
  } catch {
    // Odmowa odczytu to nie to samo co brak zapisu: dziennik może tam być.
    return { journal: EMPTY_JOURNAL, readable: false };
  }
}

/**
 * Dokłada zapis nocy.
 *
 * Czyta bezpośrednio przed zapisem i **odmawia**, gdy tego, co leży na dysku,
 * nie dało się przeczytać. Nadpisanie byłoby wtedy skasowaniem sezonu
 * obserwacji w zamian za jedną noc.
 */
export async function saveNightLog(log: NightLog): Promise<Journal | null> {
  const { journal, readable } = await loadJournal();
  if (!readable) return null;

  const updated = upsertLog(journal, log);

  try {
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

/** Nazwa pliku z datą — eksporty z różnych dni nie mają się nadpisywać. */
function exportName(now: Date): string {
  const stamp = now.toISOString().slice(0, 10);
  return `lunaris-dziennik-${stamp}.json`;
}

/**
 * Zapisuje cały dziennik do pliku i zwraca jego ścieżkę.
 *
 * Katalog dokumentów, a nie cache: system czyści cache, gdy brakuje miejsca,
 * a to jest kopia zapasowa, nie plik roboczy.
 */
export async function exportJournalToFile(now: Date = new Date()): Promise<string | null> {
  const { journal, readable } = await loadJournal();
  if (!readable) return null;

  try {
    const directory = new Directory(Paths.document, 'dziennik');
    if (!directory.exists) directory.create({ intermediates: true });

    const file = new File(directory, exportName(now));
    if (file.exists) file.delete();
    file.create();
    file.write(exportJournal(journal));

    return file.uri;
  } catch {
    return null;
  }
}
