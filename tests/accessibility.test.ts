/**
 * Konwencje dostępności w warstwie widoku.
 *
 * To reguły, które psują się dokładnie tak jak granica warstwy domenowej: nowy
 * ekran wygląda dobrze, działa dobrze i nikt nie zauważy, że czytnik ekranu
 * ogłasza na nim „przycisk bez nazwy", dopóki ktoś go faktycznie nie włączy.
 * Analiza tekstu źródeł łapie to od razu, a kosztuje jeden przebieg testów.
 *
 * Sprawdzamy tylko to, co da się rozstrzygnąć statycznie i bez fałszywych
 * alarmów. Reszta — kolejność czytania, sensowność samych etykiet — zostaje dla
 * testu na urządzeniu, którego to nie zastępuje.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const VIEW_DIRS = ['app', 'src/components'];

type Element = {
  file: string;
  line: number;
  tag: string;
  attributes: string;
  /** Znaczniki bez dzieci — `<View ... />`. */
  selfClosing: boolean;
  /** Treść między znacznikiem otwierającym a najbliższym domknięciem. */
  children: string;
};

function viewFiles(): { path: string; source: string }[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walk(path);
      return path.endsWith('.tsx') ? [path] : [];
    });

  return VIEW_DIRS.flatMap(walk).map((path) => ({
    path,
    source: readFileSync(path, 'utf8'),
  }));
}

/**
 * Atrybuty elementu otwierającego, od nazwy znacznika do domykającego `>`.
 *
 * Liczymy klamry, bo w atrybutach siedzą wyrażenia — `style={[a, b]}` czy
 * `onPress={() => f({ x })}` zawierają znaki, które naiwne szukanie `>`
 * potraktowałoby jako koniec znacznika.
 */
function elements(file: string, source: string, tags = '[A-Z][\\w.]*'): Element[] {
  const found: Element[] = [];

  for (const match of source.matchAll(new RegExp(`<(${tags})\\b`, 'g'))) {
    const start = match.index + match[0].length;
    let depth = 0;
    let end = start;

    while (end < source.length) {
      const char = source[end];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
      end += 1;
    }

    const selfClosing = source[end - 1] === '/';
    const closes = source.indexOf('</', end);

    found.push({
      file,
      line: source.slice(0, match.index).split('\n').length,
      tag: match[1],
      attributes: source.slice(start, end),
      selfClosing,
      children: selfClosing || closes === -1 ? '' : source.slice(end, closes),
    });
  }

  return found;
}

const where = (elements: Element[]) => elements.map((e) => `${e.file}:${e.line} <${e.tag}>`);

/**
 * Czy styl o tej nazwie trafia gdziekolwiek na element zawierający tekst.
 *
 * Element samodomykający się odpada od razu: nie ma dzieci, więc nie ma czego
 * przyciąć. Bez tego rozróżnienia dekoracyjna kropka `<View style={styles.dot} />`
 * wyglądała na winną tylko dlatego, że zaraz za nią stał podpis.
 */
function usedOnTextContainer(source: string, style: string): boolean {
  const applied = new RegExp(`styles\\.${style}\\b`);

  return elements('', source).some(
    (e) => applied.test(e.attributes) && !e.selfClosing && e.children.includes('<Text'),
  );
}

describe('dostępność widoku', () => {
  it('każdy element dotykalny ma rolę', () => {
    // Pressable sam z siebie nie ogłasza się jako przycisk — bez roli czytnik
    // przeczyta jego treść i nie powie, że da się w nią stuknąć.
    const offenders = viewFiles()
      .flatMap(({ path, source }) => elements(path, source, 'Pressable|TouchableOpacity'))
      .filter((e) => !e.attributes.includes('accessibilityRole'));

    assert.deepEqual(where(offenders), []);
  });

  it('element dotykalny bez tekstu w środku ma etykietę', () => {
    // Przycisk z samą ikoną nie ma czego przeczytać. Sprawdzamy po tym, czy
    // w atrybutach stoi `accessibilityLabel` — treść potomków bywa wyliczana
    // i statycznie jej nie ocenimy, więc reguła obowiązuje wszystkich.
    const iconOnly = viewFiles()
      .flatMap(({ path, source }) => elements(path, source, 'Pressable|TouchableOpacity'))
      // Ikona i ani jednego `<Text>` do przeczytania.
      .filter((e) => e.children.includes('<Ionicons') && !e.children.includes('<Text'));

    const offenders = iconOnly.filter((e) => !e.attributes.includes('accessibilityLabel'));

    assert.ok(
      iconOnly.length > 0,
      'nie znaleziono żadnego przycisku ikonowego — reguła zbadana źle',
    );
    assert.deepEqual(where(offenders), []);
  });

  it('nie ma tekstu w kontenerze o sztywnej wysokości', () => {
    // Sztywna `height` na czymś, co zawiera tekst, przycina go przy podkręconej
    // czcionce systemowej. `minHeight` rośnie razem z zawartością i o to chodzi.
    //
    // Szkielety ładowania są wyjątkiem: to prostokąty udające treść, więc mają
    // sztywny rozmiar z założenia i nie ma w nich czego przyciąć.
    const offenders = viewFiles().flatMap(({ path, source }) =>
      [...source.matchAll(/^\s*(\w+): \{\n(?:.*\n)*?\s*\},?$/gm)]
        .filter((m) => /\bheight: \d/.test(m[0]) && !/skeleton|bone|Skeleton/i.test(m[1]))
        .filter((m) => new RegExp(`styles\\.${m[1]}\\b`).test(source))
        .filter((m) => usedOnTextContainer(source, m[1]))
        .map((m) => `${path}: styles.${m[1]}`),
    );

    assert.deepEqual(offenders, []);
  });
});
