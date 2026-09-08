/**
 * Raport miesięczny z linii poleceń — pełny render tego, co aplikacja pokazuje
 * w skrócie.
 *
 * Skrypt **czyta wyeksportowany dziennik**, a nie wewnętrzny zapis aplikacji.
 * To decyzja, nie wygoda: eksport jest zwykłym plikiem, więc raport da się
 * wygenerować z kopii sprzed pół roku i wyjdzie identyczny, a telefon nie musi
 * być pod ręką. Kosztuje to jeden krok — trzeba wyeksportować dziennik z ekranu
 * Dziennik, zanim się tu po niego sięgnie.
 *
 * Jak brief: skrypt niczego nie liczy po swojemu. Cały rachunek i render są
 * w `src/lib/monthly-report.ts`, wspólne z aplikacją.
 *
 *   npm run report -- --journal ~/Pobrane/lunaris-dziennik-2026-09-08.json
 *   npm run report -- --journal dziennik.json --month 2026-04
 *   npm run report -- --journal dziennik.json --month 2026-04 --json
 */

import { readFileSync } from 'node:fs';

import { parseJournal } from '../src/lib/journal.ts';
import {
  buildMonthlyReport,
  monthKeyOf,
  monthsInJournal,
  renderMonthlyReport,
} from '../src/lib/monthly-report.ts';

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [key, inline] = token.slice(2).split('=');
    if (inline !== undefined) {
      args.set(key, inline);
      continue;
    }

    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args.set(key, '');
    else args.set(key, argv[++i]);
  }

  return args;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

const path = args.get('journal');
if (!path) fail('Podaj --journal <plik> — eksport z ekranu Dziennik.');

let raw: string;
try {
  raw = readFileSync(path, 'utf8');
} catch (error) {
  fail(`Nie mogę otworzyć ${path}: ${(error as Error).message}`);
}

// `parseJournal` zwraca null zamiast pustego dziennika i to jest tu właściwe:
// raport z pliku, którego nie umiemy przeczytać, wyglądałby jak miesiąc bez
// wyjazdów. Cisza jest gorsza od błędu, bo wygląda jak odpowiedź.
const journal = parseJournal(raw);
if (!journal) fail(`Plik ${path} nie wygląda na dziennik Lunarisa.`);

const months = monthsInJournal(journal);
const month = args.get('month') || monthKeyOf(new Date());

if (!/^\d{4}-\d{2}$/.test(month)) fail(`Miesiąc podaje się jako RRRR-MM, nie „${month}".`);

if (!months.includes(month)) {
  // Miesiąc bez wpisów nie jest błędem — po prostu się nie jeździło. Ale skoro
  // i tak wiemy, co jest w pliku, warto to powiedzieć od razu.
  process.stderr.write(
    months.length === 0
      ? 'Dziennik nie ma ani jednego wpisu.\n'
      : `Brak wpisów za ${month}. Dostępne miesiące: ${months.join(', ')}.\n`,
  );
}

const report = buildMonthlyReport(journal, month);

process.stdout.write(
  args.has('json') ? `${JSON.stringify(report, null, 2)}\n` : renderMonthlyReport(report),
);
