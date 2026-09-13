# Lunaris

Aplikacja, która odpowiada na jedno pytanie: **czy tej nocy warto gdzieś jechać z lornetką**.

Nie jest planetarium ani przeglądarką efemeryd. Liczy werdykt — „jedź, okno 22:10–02:40" albo
„nie ma po co, i oto powód" — z prognozy pogody, jasności nieba, fazy Księżyca, ukształtowania
terenu i parametrów posiadanego sprzętu. Interfejs jest po polsku, obszar odniesienia to
południowa Polska.

## Zasady, z których wynika reszta

**Werdykt jest deterministyczny.** Te same dane wejściowe zawsze dają ten sam wynik. Żadnego
modelu językowego w ścieżce decyzyjnej — [warstwa narracyjna](src/lib/narrative.ts) może werdykt
_opisać_, ale jej schemat nie ma ani jednego pola liczbowego, więc nie ma czym go zmienić.

**Wszystkie progi są w konfiguracji, nie w kodzie.** [`session-engine.ts`](src/lib/session-engine.ts)
nie zna ani jednej własnej liczby. Progi mają być strojone po tygodniach porównywania werdyktów
z rzeczywistością, a strojenie nie może wymagać rekompilacji.

**Rachunek nie zna widoku.** `src/lib` i `src/data` są warstwą domenową: bez Reacta, bez React
Native, bez aliasu `@/` — wyłącznie importy względne z rozszerzeniem `.ts`. Dzięki temu ten sam
kod liczy na telefonie, w CLI i w teście. Pilnuje tego [test granicy](tests/domain-boundary.test.ts),
bo jeden przypadkowy import wywraca uruchomienie poza Metro, a `tsc` tego nie zauważy.

**Ciężkie dane liczą się przed wydaniem, nie na telefonie.** Mapa jasności nieba i maski horyzontu
powstają skryptami z surowych rastrów; aplikacja dostaje gotowe liczby.

**Aplikacja mówi też do uczącego się.** Lista celów odpowiada na „co złapię lornetką", ale
pytanie wcześniejsze brzmi „co to świeci nad głową" — stąd
[warstwa orientacyjna](src/lib/constellations.ts) z gwiazdozbiorami tej nocy. Powstała po
pierwszym wyjeździe w teren, bo dotąd aplikacja zakładała, że wiesz, gdzie szukać.

**Dziennik obserwacji jest sprzężeniem zwrotnym.** Zasięg sprzętu i progi to przybliżenia. Jedyne
dane, które mogą je nastroić, to odpowiedź na pytanie „widziałeś?" — stąd
[dziennik](src/lib/journal.ts) i [raport miesięczny](src/lib/monthly-report.ts).

## Uruchomienie

Wymagany Node **≥ 22.13** (Expo SDK 57) — skrypty i testy chodzą na `--experimental-strip-types`.

```bash
npm install
npm start          # Expo — potem QR w Expo Go albo klawisz a / i
```

Sprawdzenie całości przed commitem:

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

## Narzędzia z linii poleceń

Ten sam silnik, bez aplikacji — i zarazem test regresyjny: gdy werdykt zaczyna być bzdurny, widać
to na stdout, a nie po miesiącu nieudanych wyjazdów.

```bash
# Werdykt na najbliższe noce jako JSON. Pod crona.
npm run brief -- --site=bledowska --nights 3 --pretty
npm run brief -- --lat 50.35 --lon 19.53 --notices ~/.lunaris-notices.json

# Werdykt z prawdziwym kalendarzem zamiast założonej godziny pobudki.
npm run google:auth                                # raz, otwiera przeglądarkę
npm run brief -- --site=bledowska --calendar

# Rezerwacja sesji w kalendarzu. Bez --confirm tylko pokazuje, co powstanie.
npm run book -- --site=bledowska
npm run book -- --site=bledowska --confirm
npm run book -- --site=bledowska --cancel     # odwołuje i usuwa wpis

# Raport miesięczny z wyeksportowanego dziennika.
npm run report -- --journal ~/Pobrane/lunaris-dziennik-2026-09-08.json --month 2026-04

# Podgląd samej prognozy dla miejscowości albo punktu.
npm run weather -- Zawoja
npm run weather -- --lat 49.63 --lon 19.53
```

`report` czyta **wyeksportowany plik**, a nie pamięć aplikacji — celowo: raport da się wtedy
wygenerować z kopii sprzed pół roku i wyjdzie identyczny, kosztem jednego kroku eksportu.

### Generatory danych

Uruchamiane rzadko, wynik idzie do repozytorium.

```bash
npm run build:places    # miasta i gminy + Bortle z World Atlas
npm run build:sky-map   # siatka jasności nieba dla obszaru dojazdowego
npm run build:horizon -- --lat 50.35 --lon 19.53   # maska terenu dla miejscówki
npm run build:icons     # ikony aplikacji, ekran startowy, sylwetka powiadomień
```

## Build na telefon

Aplikacja korzysta z modułów natywnych (`expo-notifications`, `expo-location`), więc **Expo Go nie
wystarcza do sprawdzenia wszystkiego** — powiadomienia wymagają własnego buildu. Katalogów
`android/` i `ios/` nie ma w repozytorium: powstają na żądanie z `app.json` (`npx expo prebuild`),
a źródłem prawdy jest konfiguracja, nie wygenerowany kod.

```bash
npx eas-cli@latest login         # jednorazowo
npm run build:dev                # dev client — do pracy i do testu terenowego
npm run build:apk                # samodzielny APK do zainstalowania
```

`eas-cli` celowo nie jest zależnością projektu — `expo-doctor` to zgłasza, a build na EAS przez
to pada.

Profile stoją w [`eas.json`](eas.json): `development` (dev client, APK), `preview` (APK do
rozdania) i `production` (AAB pod Google Play, z automatycznym numerem wersji). Podpisywaniem
zajmuje się EAS — klucz generuje się przy pierwszym buildzie i zostaje na koncie.

**Node na serwerze buildów jest przypięty** (`"node"` w każdym profilu). Domyślny obraz ma npm 10,
który czyta lock surowiej niż npm 11+: opcjonalny peer `react-native-worklets` w
`expo-modules-core` (`^0.10`) kłóci się z wersją od reanimated (`0.12.x`), więc npm 10 odrzuca
lock jako niezsynchronizowany, a nowszy go przyjmuje. Zanim zmienisz tę wersję, sprawdź lokalnie
za darmo: `npx npm@<wersja npm z tego Node> ci --dry-run --include=dev`.

Identyfikator aplikacji to `com.igormusial.lunaris`. Zmiana jest darmowa **teraz**; po pierwszej
publikacji w Google Play pakietu nie da się już podmienić.

## Układ katalogów

```
app/            ekrany (expo-router); (tabs)/ to Noc, Eventy, Ustawienia
src/lib/        warstwa domenowa — cały rachunek, zero widoku
src/data/       katalogi i dane generowane (miejsca, obiekty, mapa nieba)
src/components/ elementy widoku
src/hooks/      most między widokiem a domeną; tu wolno wszystko
src/store/      konfiguracja i cykl pobierania prognozy (konteksty Reacta)
scripts/        CLI i generatory
tests/          testy Node (`node:test`), bez frameworka
```

Warto zajrzeć najpierw do [`session-engine.ts`](src/lib/session-engine.ts) (kiedy jechać),
[`sky-targets.ts`](src/lib/sky-targets.ts) (co oglądać) i [`config.ts`](src/lib/config.ts)
(wszystkie progi).

## Testy

```bash
npm test    # całość
TZ=Europe/Warsaw node --experimental-strip-types --test tests/seeing.test.ts   # jeden plik
```

Trzy rzeczy warte wiedzenia, zanim się dopisze test:

- **Strefa czasowa jest przypięta** (`TZ=Europe/Warsaw` w skrypcie). Noc, zmiana czasu i granice
  miesiąca zależą od kalendarza obserwatora — test, który przechodzi tylko na jednej maszynie,
  nie jest testem.
- **Pogoda w testach jest zamrożona** ([`tests/fixtures/nights.ts`](tests/fixtures/nights.ts)).
  Na prawdziwej prognozie test odpowiadałby na pytanie o dzisiejsze chmury, a nie o zachowanie
  silnika.
- **Node tylko usuwa typy, nie kompiluje.** Składnia, która generuje kod (`enum`, parametry
  z modyfikatorem dostępu, przestrzenie nazw), przejdzie `tsc` i wywali się dopiero w locie.

Kilka testów pilnuje konwencji, a nie rachunku: granicy warstwy domenowej, kontrastu palety
i etykiet dostępności. Psują się cicho, więc są sprawdzane maszynowo.

## Źródła danych

| Źródło                                                                | Do czego                                                       | Licencja               |
| --------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| [Open-Meteo](https://open-meteo.com)                                  | prognoza pogody, w tym dane z poziomów ciśnieniowych na seeing | CC BY 4.0              |
| World Atlas 2024 (David Lorenz)                                       | jasność nieba, skala Bortle'a                                  | wg autora mapy         |
| [GUGiK / PZGiK](https://www.geoportal.gov.pl)                         | NMPT i NMT pod maski horyzontu                                 | bezpłatnie, bez klucza |
| GeoNames, OpenStreetMap                                               | gminy i miasta                                                 | CC BY / ODbL           |
| [Astronomy Engine](https://github.com/cosinekitty/astronomy), suncalc | efemerydy liczone lokalnie                                     | MIT                    |
| [NASA APOD](https://apod.nasa.gov)                                    | zdjęcie dnia na ekranie Noc                                    | wg autora zdjęcia      |
| Google Calendar                                                       | realna godzina pobudki zamiast założenia                       | dane użytkownika       |

Atrybucja jest też w aplikacji, w Ustawieniach.

Kalendarz wymaga jednorazowej autoryzacji OAuth — osobno dla CLI i dla telefonu, bo to dwa różne
klienty w Google Cloud Console:

- **CLI** — klient typu „aplikacja komputerowa". Poświadczenia trafiają do
  `~/.lunaris/google-client.json` (uprawnienia `600`, poza repozytorium), a `npm run google:auth`
  wymienia je na token odświeżania. Bez `--calendar` nic z tego nie jest potrzebne.
- **Aplikacja** — klient typu „Android" z nazwą pakietu `com.igormusial.lunaris`, odciskiem SHA-1
  certyfikatu, którym EAS podpisuje buildy, i włączonym niestandardowym schematem URI. Taki klient
  nie ma sekretu, więc jego identyfikator stoi jawnie w
  [`google-account.ts`](src/lib/google-account.ts), a token odświeżania leży w `expo-secure-store`.
  Połączenie włącza się w Ustawieniach i działa tylko we własnym buildzie: w Expo Go przekierowanie
  po zgodzie nie ma dokąd wrócić.

Po połączeniu aplikacja liczy pobudkę z kalendarza — na ekranie Noc, w przeglądzie miejscówek
i w cyklu powiadomień, bo to ma być jeden rachunek — a karty nocy „jedź" dostają przyciski
rezerwacji i odwołania. Nic nie zapisuje się samo. Bez połączenia obowiązuje założenie
z konfiguracji.

**Pobudkę wyznacza kilka kalendarzy, nie tylko główny.** Domyślnie liczą się główny i własne
kalendarze widoczne w Google Calendar; subskrypcje w rodzaju świąt i urodzin — nie. Wybór zmienia
się w Ustawieniach, zapisuje w `calendar.calendarIds` i obowiązuje też w CLI (`brief`, `book`).
Rezerwacje zawsze trafiają do głównego. Lista kalendarzy wymaga zakresu
`calendar.calendarlist.readonly` — połączenie sprzed jego dodania trzeba odnowić: w aplikacji
odłączyć i połączyć konto, w CLI powtórzyć `npm run google:auth`. Do tego czasu liczy się tylko
główny kalendarz.

Klucza wymaga tylko APOD i domyślnie idzie na `DEMO_KEY`, który działa bez rejestracji — przy
pobraniu raz na dobę limit wystarcza z zapasem. Własny klucz z [api.nasa.gov](https://api.nasa.gov)
podaje się w `EXPO_PUBLIC_NASA_KEY`. Zdjęcia bywają cudzą własnością, dlatego karta pokazuje podpis
autora, gdy API go zwraca.

## Stan i ograniczenia

Projekt prywatny, jeden użytkownik, bez wydania. Rzeczy świadomie niezrobione:

- **Powiadomienia wymagają własnego buildu.** Na Androidzie w Expo Go `expo-notifications` nie
  istnieje — od SDK 53 rzuca już przy ładowaniu modułu, więc aplikacja wykrywa to środowisko
  i **nie sięga po niego wcale** (dynamiczny import za bramką `NOTIFICATIONS_AVAILABLE`), a ekran
  Ustawień mówi o tym wprost. Decyzja, co i kiedy ma zabrzmieć, siedzi w
  [`notification-plan.ts`](src/lib/notification-plan.ts) i jest pokryta testami; niesprawdzone
  zostaje samo wywołanie systemowe.
- **Zadanie w tle** nie jest jeszcze podpięte: plan powstaje przy odświeżeniu cyklu, czyli po
  otwarciu aplikacji.
- **Token Google wygasa po tygodniu**, dopóki projekt w Google Cloud Console jest w trybie
  testowym — tak Google traktuje zakres kalendarza w nieopublikowanych aplikacjach. Aplikacja
  rozpoznaje to po `invalid_grant` i pokazuje konto jako odłączone; CLI każe ponowić
  `npm run google:auth`.
- **Progi nie są skalibrowane.** Domyślne wartości są ostrożne i czekają na dane z dziennika.
- **Jasność powierzchniowa liczona jest ze średniej po całej powierzchni**, więc nie odróżnia M31
  — rozlanej, ale z jasnym jądrem — od dowolnej galaktyki w Pannie. Naprawa wymaga pola, którego
  katalog nie ma: koncentracji światła albo publikowanej klasyfikacji lornetkowej.
- **Tatrzański Park Narodowy jest poza katalogiem miejsc**, mimo najciemniejszego nieba w zasięgu:
  poruszanie się po parku nocą jest zabronione.
