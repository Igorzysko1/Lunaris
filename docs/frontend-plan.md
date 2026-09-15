# Nowy frontend — plan podpinania

Źródło: projekt Claude Design „Lunaris" (`Lunaris IA.dc.html`, `Lunaris Noc - werdykt.dc.html`,
`Lunaris tryb czerwony.dc.html`, `constellation-figures.js`, `deep-sky-catalog.js`), pobrany
15 września 2026. Gałąź: `redesign/mockups`.

## Gdzie jesteśmy

Makieta jest w aplikacji: pięć zakładek (Noc · Gdzie · Kalendarz · Dziennik · Więcej), arkusze
i podstrony z projektu, wszystko na stałych danych.

| Warstwa       | Pliki                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Klocki UI     | `src/ui/kit.tsx`, `src/ui/night.tsx` (paski nocy, słupki godzinowe), `src/ui/figure.tsx`                                     |
| Dane makiety  | `src/mock/*.ts` — liczby i zdania przepisane z projektu                                                                      |
| Stany makiety | `src/mock/state.tsx` + ekran Więcej › Makieta › Stany makiety                                                                |
| Zakładki      | `app/(tabs)/{index,where,calendar,log,more}.tsx`                                                                             |
| Arkusze       | `app/{target,constellation,site,event}/[id].tsx`, `app/library/target/[id].tsx`, `app/close-night.tsx`, `app/night-mode.tsx` |
| Podstrony     | `app/entry/[id].tsx`, `app/notifications.tsx`, `app/library/{targets,constellations}.tsx`                                    |
| Stare ekrany  | `app/legacy/*` (dawne zakładki) + `app/{journal,sites,review}.tsx` — działają, dostępne z Więcej › Stare ekrany              |

Każdy przycisk bez logiki woła `todo('…')` i pokazuje „Do zrobienia". Lista tych wywołań
(`grep -rn "todo(" app src`) to kontrola kompletności: po ostatnim etapie ma być pusta.

## Zasady podpinania

1. Jeden etap = jeden commit (albo mała seria). Po etapie: `npm run typecheck`, `npm run lint`,
   `npm test`, przejście ekranów na telefonie.
2. Ekran bierze dane z `src/lib`, `src/store`, `src/hooks` — nie liczy niczego sam. Stała z `src/mock`
   znika w chwili, gdy jej miejsce zajmuje prawdziwe źródło; pusty plik mocka się usuwa.
3. Wygląd się nie zmienia: klocki z `src/ui` przyjmują dane, więc podpięcie podmienia propsy.
4. Stary ekran z `app/legacy` usuwamy dopiero wtedy, gdy jego następca robi wszystko, co on.
5. Zdania z domeny (`describeWarning`, `describeRejection`, `explainScore`, `nightLabel`,
   `formatDuration`) idą dosłownie z kodu — projekt je cytuje, więc nie przepisujemy ich w widoku.

Oznaczenia w tabelach: **jest** — logika istnieje, trzeba podpiąć; **UI** — brak backendu nie jest
problemem, to sama praca w widoku; **DO ZROBIENIA** — brakuje danych, pola, akcji albo zależności.

## Kolejność

Zgodna z rekomendacją projektu: najpierw to, co ustala rytm zakładki Noc, na końcu tryb czerwony.

### Etap 1 — Noc: werdykt, selektor nocy, stany bez prognozy

**Stan: podpięte w kodzie 15 września 2026, bez commita — czeka na przejście na telefonie.**
Ekran bierze wszystko z `src/hooks/use-night-verdicts.ts` i `src/hooks/use-known-tonight.ts`;
rachunek i zdania są w `src/lib/night-summary.ts` i `src/lib/session-text.ts`
(test: `tests/night-summary.test.ts`).

| Element                                                             | Źródło                                                         | Status                                                                                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Werdykt JEDŹ/ODPUŚĆ, ocena 1–5, okno, długość                       | `planNights` przez `useSessions`, `astro.ratingScore`          | podpięte                                                                                                                                           |
| Pasek nocy: zachód, ciemność, okno, Księżyc nad horyzontem, „teraz" | `night-summary.nightBar`, `positionOnAxis`, `useNow`           | podpięte — znacznik Księżyca przy wschodzie, a gdy świeci od zmierzchu — przy zachodzie                                                            |
| Chipy: chmury, seeing, min. temperatura, rosa                       | `session-text.verdictChips`                                    | podpięte — seeing jako ocena 1–5 (decyzja: zostaje; prognoza nie podaje sekund łuku)                                                               |
| Zdanie werdyktu                                                     | `session-text.narrateVerdict` na `night-summary`               | podpięte — nowy generator; `narrative.ts` to narracja agenta z Dysku i zostaje dla CLI                                                             |
| Stan „ODPUŚĆ": pasek zakreskowany, zdanie z liczbami, żetony        | `rejectionLabels`, `narrateVerdict`                            | podpięte — „ani na godzinę" tylko wtedy, gdy próg jest przekroczony w każdej godzinie; inaczej zdanie z `describeRejection`                        |
| Żeton najbliższej dobrej nocy                                       | `useNightVerdicts.bestNight`                                   | podpięte w zakresie prognozy — 3 noce (decyzja: `CYCLE_NIGHTS` bez zmian); bez dobrej nocy żeton mówi „brak dobrej nocy w prognozie"               |
| Selektor nocy ‹ ›                                                   | `nightRelative`, `nightHeading`, `date.formatNightSpan`        | podpięte — po północy trwająca noc to „ta noc", nie „dziś"                                                                                         |
| Dotknięcie miejsca → wybór lokalizacji                              | `app/location.tsx`                                             | jest (reskin w etapie 8)                                                                                                                           |
| Noc w trakcie: „W TRAKCIE", licznik do końca sesji                  | `liveNightIndex` + okno sesji                                  | podpięte; przełącznik makiety „noc w trakcie" zostaje dla Planu (etap 5)                                                                           |
| Brak prognozy: powody i pierwsze pobranie                           | `useForecast().failure`, `daily-cycle.describeForecastFailure` | podpięte                                                                                                                                           |
| Szczegół błędu pod komunikatem                                      | `ForecastProvider` → `cycle.lastError`                         | podpięte — pole już istniało                                                                                                                       |
| Pasek „dane z zapisu" z wiekiem                                     | `stale`, `savedAt`, `formatAge`                                | podpięte                                                                                                                                           |
| „Odśwież" / „Spróbuj ponownie"                                      | `useForecast().refresh`, `daily-cycle.rateLimitCooldown`       | podpięte — ręczne odświeżenie pomija terminarz, ale po 429 czeka 30 min od próby (przycisk pokazuje „po 17:32"; provider też nie wymusza pobrania) |
| „Co i tak wiadomo": zmierzch, świt, Księżyc, cele, gwiazdozbiory    | `useKnownTonight`                                              | podpięte                                                                                                                                           |

Z `src/mock/night.ts` zniknęły `NIGHTS`, `PLACE_HEADER`, `VERDICT`, `NIGHT_BAR`, `NOW_ON_BAR`,
`NARRATIVE`, `VERDICT_CHIPS`, `REJECT`, `NO_FORECAST`, `KNOWN_ANYWAY`, `STALE_AGE` i pola licznika
w `LIVE`; ze stanów makiety — przełączniki „prognoza", „powód braku prognozy" i „werdykt". Zostały
dla kolejnych etapów: `BOOKING_WARNING` i lista odhaczeń `LIVE` (etap 5). Zakładka Gdzie pokazuje
ranking częściowy według `bundle === null` zamiast przełącznika.

### Etap 2 — Noc › Warunki

**Stan: podpięte w kodzie 15 września 2026, bez commita — czeka na przejście na telefonie
(w tym kryterium „ok. 1,3 ekranu na 360×800", którego nie da się sprawdzić bez urządzenia).**
Segment bierze dane z `src/hooks/use-night-conditions.ts`; rachunek jest w
`src/lib/night-conditions.ts`, zdania w `src/lib/session-text.ts` (test:
`tests/night-conditions.test.ts`).

| Element                                      | Źródło                                                                | Status                                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zachmurzenie godzinowe z oknem i progiem     | `night-conditions.nightConditions`, `config.conditions.maxCloudTotal` | podpięte — oś to noc astronomiczna wybranej nocy (`NightSlice`), nie 20:00–07:00 z projektu; przy „odpuść" bez zaznaczonego okna                                    |
| Wilgotność, punkt rosy, opady                | `weather.NightHour`                                                   | podpięte — opady już były w godzinach prognozy; wilgotność i punkt rosy z okna sesji (przy „odpuść" z całej nocy), opady z całej nocy                               |
| Zapas nad punktem rosy i godzina zaparowania | `session-text.describeDew`, `dewWarningSpreadC`                       | podpięte                                                                                                                                                            |
| Karta seeingu tylko przy teleskopie          | `night-conditions.seeingProfile`, `seeing.seeingCanLimit`             | podpięte — rozstrzyga powiększenie, nie nazwa sprzętu: karta, gdy któryś zestaw ma ≥ 80x (próg najsłabszego seeingu); lornetka 15x zostaje przy żetonie w werdykcie |
| Czasy astronomiczne                          | `night-summary` (zachód, ciemno, świt astr., wschód)                  | podpięte                                                                                                                                                            |
| Faza Księżyca → kalendarz Księżyca           | `moon.moonAt`, `moonEventTonight`, `app/moon.tsx`                     | podpięte; kalendarz w nowym wyglądzie, otwiera się na dniu wybranej nocy                                                                                            |
| Progi warunków → edycja                      | `config.conditions`, `app/thresholds.tsx`                             | podpięte; ekran w nowym wyglądzie, doszła „kara za godzinę dojazdu" (`travelPenaltyPerHour`), której dotąd nie dało się edytować                                    |

Przy okazji poprawiony błąd w `moon.ts`: faza z suncalc cofa się o setne części tuż przed pełnią
i nowiem, a każdy spadek liczył się jako nów — przed pełnią 26.09.2026 opis mówił „Nów za 11 dni",
a kalendarz znaczył pełnię jako nów. Test: `tests/moon.test.ts`.

Z `src/mock/night.ts` zniknęły `CLOUDS`, `HUMIDITY`, `ASTRO_TIMES`, `MOON`, `THRESHOLDS_SUMMARY`.
`HOUR_AXIS` zostaje dla profilu wysokości w panelu celu (etap 4).

### Etap 3 — Zapis nocy i Dziennik

| Element                                                             | Źródło                                                                     | Status                                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Arkusz „Jak było?": cele z planu, dwie skale, notatka, zapis        | `journal.upsertLog`, `journal-store.saveNightLog`, `planNights`            | jest                                                                                   |
| „Dopisz, co doszło" — cel spoza planu                               | `TargetObservation.targetId` przyjmuje dowolny cel                         | **UI**: wybór celu z katalogu                                                          |
| Historia nocy pogrupowana miesiącami                                | `journal-store.loadJournal`, `date.formatMonth`                            | jest                                                                                   |
| Podsumowanie sezonu: noce / widziane / nie wyszło                   | `monthly-report.buildMonthlyReport` liczy miesiąc                          | **UI**: agregacja roczna z tych samych danych                                          |
| „Dziś lepiej niż wtedy: M33…"                                       | `journal.conditionsImproved`, `orderByHistory`                             | jest                                                                                   |
| Wpis nocy: cele, oceny, notatka, powód „nie wyszło przy…"           | `NightLog`, `AttemptConditions`                                            | jest                                                                                   |
| Przebieg nocy: zmierzone godziny obok planowanych, „Popraw godziny" | `session-timeline.adjustStep`, `plannedFrom`, `journal-store.saveTimeline` | jest                                                                                   |
| „Edytuj" — ten sam arkusz na istniejącym wpisie                     | `journal.nightLogId` (jedna noc = jeden wpis)                              | jest                                                                                   |
| Chip „zwinąłem — rosa" (powód zakończenia nocy)                     | `NightLog` nie ma takiego pola                                             | **DO ZROBIENIA**: pole powodu przerwania + podbicie `JOURNAL_VERSION`                  |
| Eksport dziennika                                                   | `journal-store.exportJournalToFile`                                        | jest (zapis na dysk); **DO ZROBIENIA**, jeśli ma być „udostępnij": brak `expo-sharing` |

Po etapie usuwamy `app/journal.tsx`.

### Etap 4 — Noc › Niebo i panel celu

| Element                                          | Źródło                                                 | Status                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Cele w zasięgu posortowane oknem, wysokość maks. | `sky-targets.nightTargetsForProfiles`, `rankedTargets` | jest                                                                                             |
| Przełącznik zestawu optyki                       | `config.opticsProfiles`, `optics.profileLabel`         | jest                                                                                             |
| Znacznik „1. RAZ"                                | `journal.historyOf`                                    | jest                                                                                             |
| „3 cele poza zasięgiem" + lista                  | `sky-targets.describeOutOfReach`                       | jest                                                                                             |
| Chip „Następny event" → Kalendarz › Eventy       | `events.upcomingEvents`                                | jest                                                                                             |
| Gwiazdozbiory teraz nad horyzontem (≥ 20°)       | `constellations.constellationsTonight`                 | jest                                                                                             |
| Panel celu: widoczność, profil wysokości, azymut | `sky-targets.skyPathOverNight`                         | jest                                                                                             |
| Panel celu: historia zobaczeń                    | `journal.describeHistory`                              | jest                                                                                             |
| „Widziałem — 23:04" (odhaczenie w trakcie sesji) | `TargetObservation` nie ma godziny                     | **DO ZROBIENIA**: pole `seenAt` + migracja dziennika; zapis w trakcie nocy, zanim powstanie wpis |
| „Dopisz do planu tej nocy"                       | plan nocy wylicza cele sam, nie zna ręcznego wyboru    | **DO ZROBIENIA**: przechowywanie celów wybranych na noc i uwzględnienie ich w `planNights`       |

### Etap 5 — Noc › Plan i rezerwacja

| Element                                                      | Źródło                                                                                                | Status                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Przebieg nocy: wyjazd, parking, sesja, powrót, początek dnia | `night-plan.planNights`                                                                               | jest                                                                                  |
| Sen, min. temperatura, odczuwalna                            | `PlannedNight.minTemperature`, `feltTemperature`                                                      | jest                                                                                  |
| Ostrzeżenia                                                  | `session-text.describeWarning`                                                                        | jest                                                                                  |
| Zarezerwuj / Zaktualizuj wpis / Odwołaj sesję                | `session-booking.bookingFor`, `google-calendar.upsertBooking`, `deleteBooking` (jak `BookingButtons`) | jest                                                                                  |
| Brak konta Google → „Połącz Kalendarz Google"                | `google-account.isGoogleConnected`, `GOOGLE_AVAILABLE`                                                | jest                                                                                  |
| Noc w trakcie: odhaczenia, „co dalej dziś", „zapisz noc"     | `session-timeline`, `moon`, etap 3 i 4                                                                | jest (zależy od `seenAt` z etapu 4)                                                   |
| Tryb sesji (nocleg w terenie)                                | `config.session.overnight`                                                                            | jest — otwarte pytanie projektu: czy zmienia Plan na tyle, żeby dostać osobny segment |

Po etapie znika sekcja „Nadchodzące sesje" ze starej Nocy.

### Uzupełnienia z pełnego pliku projektu (tury 2–6)

Pierwsza wersja planu powstała z pliku uciętego po turze 6. Te pozycje doszły po lekturze całości
i należą do etapów w nawiasach.

| Element                                                                                    | Źródło                                                                          | Status                                                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| (1) Stan „ODPUŚĆ · 1/5": pasek zakreskowany w całości, zdanie z liczbami, żetony           | `evaluateNight` → `Rejection`, `session-text.rejectionLabels`, `narrateVerdict` | podpięte (etap 1)                                                             |
| (1) Żeton „czwartek 4/5 ›" — najbliższa dobra noc                                          | `useNightVerdicts.bestNight`                                                    | podpięte w zakresie 3 nocy (etap 1)                                           |
| (2) Karta seeing tylko przy teleskopie, przy lornetce żeton w werdykcie                    | `night-conditions.seeingProfile`, `seeing.seeingCanLimit`                       | podpięte (etap 2) — z powiększenia zestawu (≥ 80x), bez nowego pola w profilu |
| (3) Trzy stany celu w arkuszu: puste / widziałem / nie wyszło                              | `Outcome = 'seen' \| 'failed'`                                                  | jest                                                                          |
| (3) Powód „nie wyszło" z listy: rosa · chmury · zmęczenie · sprzęt · zwinąłem · inne       | `TargetObservation` nie ma powodu                                               | **DO ZROBIENIA**: pole powodu + własne wpisy w podpowiedziach                 |
| (3) „Rosa wyprzedziła prognozę o godzinę. Podnieść próg zapasu do 3 K?"                    | `config.conditions.dewWarningSpreadC`                                           | **DO ZROBIENIA**: reguła propozycji korekty progu z nieudanych celów          |
| (3) Szkic wpisu istnieje od pierwszego odhaczenia i przeżywa zamknięcie arkusza            | `journal-store.saveNightLog`                                                    | **DO ZROBIENIA**: zapis szkicu w trakcie nocy (razem z `seenAt`)              |
| (4) Panel celu poza sesją: „Pokrywa się z oknem tylko na 2 h 30 min"                       | `skyPathOverNight` ∩ okno nocy                                                  | jest — zdanie do dopisania w `session-text`                                   |
| (4) „W tym zestawie: pow. 81× okularem 25 mm · pole 36′"                                   | `optics.ts`                                                                     | **DO ZROBIENIA**: sprawdzić, czy profil zna okular; jeśli nie — pole okularu  |
| (4) Pusta historia: „Jeszcze nie widziany. Po zapisaniu nocy pojawi się tu pierwszy wpis." | `journal.historyOf`                                                             | **UI**                                                                        |
| (5) „Ta noc nie przechodzi już progów, a jej rezerwacja wciąż jest w kalendarzu."          | `unbookedNights` odwrotnie: wpis bez werdyktu „jedź"                            | **DO ZROBIENIA**: wykrycie rezerwacji nocy, która spadła poniżej progów       |
| (9) Zasięg trzystanowy w trybie czerwonym: w zasięgu / graniczny / poza                    | `optics.ts` zwraca tak/nie                                                      | **DO ZROBIENIA**: próg „graniczny" w rachunku zasięgu                         |

Rozstrzygnięcie projektu: Dziennik bez segmentów (tura 14) zastępuje „Dziennik › Ta noc / Miesiąc /
Historia" z tury 4c; zapisany wpis czyta się jako Wpis nocy (14b).

### Etap 6 — Gdzie

| Element                                                                      | Źródło                                                                             | Status                                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ranking: warte rozważenia / zdominowane / odpada / bez prognozy              | `site-review.reviewNights` → `go`, `dominated`, `noGo`, `missing`; `useSiteReview` | jest                                                                            |
| Zdanie wyniku („niebo 72/100, minus 6 za 30 min drogi")                      | `site-review.explainScore`                                                         | jest                                                                            |
| „Tylko stąd: M33, NGC 7000"                                                  | `SiteOutlook.uniqueTargets`                                                        | jest                                                                            |
| „noc: dziś ▾"                                                                | `reviewNights` dla kolejnych nocy                                                  | jest                                                                            |
| Katalog z Bortle i dojazdem                                                  | `config.sites`, `sky-map.skyQualityAt`, `astro.distanceKm`                         | jest                                                                            |
| „Jestem tutaj": fix GPS z dokładnością, nowe miejsce / korekta współrzędnych | `use-device-location.capturePosition`, akcje miejscówek ze `app/sites.tsx`         | jest                                                                            |
| Szczegół: horyzont, przeszkody, „usuń"                                       | `config` `HorizonOverride`, `horizon.isValidMask`, settings store                  | jest                                                                            |
| Szczegół: notatki z wyjazdów                                                 | `ObservingSite`                                                                    | **DO ZROBIENIA**: sprawdzić, czy miejsce ma pole notatek; jeśli nie — dodać     |
| „Obserwuj stąd tej nocy"                                                     | `ActiveLocation` w settings store, `use-booking-site`                              | jest                                                                            |
| „Nawiguj ↗"                                                                  | —                                                                                  | **UI**: `Linking` z `geo:` / URL map                                            |
| „Usuń miejsce"                                                               | akcje miejscówek z `app/sites.tsx`                                                 | jest                                                                            |
| „Pobierz prognozę dla tych dwóch"                                            | `weather.fetchUpcomingNightsForPoints`                                             | **DO ZROBIENIA**: akcja w `ForecastProvider` pobierająca tylko brakujące punkty |
| Mapa zanieczyszczenia światłem ↗                                             | `light-pollution.lightPollutionMapUrl`                                             | jest                                                                            |

Do rozstrzygnięcia z projektu przed etapem: czy wybrana miejscowość z Nocy (np. Zawoja) wchodzi do
rankingu jako zwykły wiersz, oraz czy wiersz rankingu pokazuje wynik po karze (66) czy ocenę 1–5.
Po etapie usuwamy `app/sites.tsx` i `app/review.tsx`.

### Etap 7 — Kalendarz, Eventy, powiadomienia

| Element                                                     | Źródło                                                                          | Status                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Siatka miesiąca, kropki, nawigacja ‹ ›                      | `useCalendarMonth`, `calendar-view.monthCells`, `eventsOnDay`                   | jest                                                                                           |
| Propozycja sesji z ✓                                        | `calendar-view.unbookedNights`, `upsertBooking`                                 | jest                                                                                           |
| Edycja godzin po kwadransie, notatka, Zapisz/Usuń           | `patchEventTimes`, `checkObservationTimes`, `patchObservation`, `deleteBooking` | jest                                                                                           |
| Dzień dzisiejszy → „Idź do Nocy"                            | nawigacja                                                                       | **UI**                                                                                         |
| Eventy: 60 dni, granica prognozy, werdykt nocy              | `events.upcomingEvents`, `event-review.reviewEvents`                            | jest                                                                                           |
| Szczegół zjawiska: radiant, Księżyc, ZHR, kiedy się odezwie | `meteor-showers`, `planetary-events`, `reviewEvents`, `notification-plan`       | jest                                                                                           |
| „Zarezerwuj tę noc" dla zjawiska poza prognozą              | `bookingFor` wymaga planu nocy                                                  | **DO ZROBIENIA**: rozstrzygnąć, co rezerwuje zapowiedź bez planu (całą noc? blokuje przycisk?) |
| „Wycisz to zjawisko"                                        | brak listy wyciszeń                                                             | **DO ZROBIENIA**: wyciszenia pojedynczych zjawisk w `NoticeLog` / `event-review`               |
| Powiadomienia: wyprzedzenie                                 | `settings.leadTime`, `LEAD_TIMES`                                               | jest                                                                                           |
| Powiadomienia: zaplanowane i przemilczane z powodem         | `notice-store.loadNoticePlan`, `loadNoticeLog`, `NoticeReason`                  | jest                                                                                           |
| Kategorie: zaćmienia, roje, koniunkcje, fazy Księżyca       | brak w `LunarisConfig`                                                          | **DO ZROBIENIA**: pole kategorii + filtr w `reviewEvents`/`planNotifications`                  |
| Pora przeglądu 18:00                                        | `config.refresh.hourOfDay` dotyczy odświeżania prognozy                         | **DO ZROBIENIA**: sprawdzić, czy przegląd zjawisk ma własną godzinę; jeśli nie — pole          |
| „Pokaż Oriona"                                              | arkusz gwiazdozbioru                                                            | **UI**                                                                                         |

Po etapie usuwamy `app/legacy/calendar.tsx` i `app/legacy/events.tsx`.

### Etap 8 — Więcej, nastawy, biblioteki

| Element                                                              | Źródło                                                                                    | Status                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Menu z bieżącą wartością w drugiej linijce                           | settings store                                                                            | jest                                                                                               |
| Podstrony: Sprzęt, Profil obserwatora, Kalendarz Google, Lokalizacja | sekcje z `app/legacy/settings.tsx`                                                        | **UI**: rozbicie jednego ekranu na podstrony + reskin                                              |
| Zdjęcie dnia NASA                                                    | `apod.fetchApod`, `useApod`, `ApodCard`                                                   | jest                                                                                               |
| Źródła danych i o aplikacji                                          | `weather.forecastSources`                                                                 | **UI**                                                                                             |
| Prognozy w pamięci: ile miejsc, wiek                                 | `forecast-cache.formatAge`, `expiredKeys`                                                 | **DO ZROBIENIA**: listowanie zapisanych prognoz                                                    |
| Biblioteka celów: szukanie, filtry, „tylko w zasięgu"                | `DEEP_SKY_OBJECTS`, `optics.limitingMagnitude`, `surfaceBrightness`, `minimumAngularSize` | jest (makieta ma zastępczy próg 9 mag)                                                             |
| Profil celu: „czy to zobaczysz" z powodem                            | te same wzory `optics.ts` dla obu zestawów                                                | jest                                                                                               |
| Profil celu: macierzysty gwiazdozbiór                                | `DeepSkyObject` nie ma pola                                                               | **DO ZROBIENIA (dane)**: pole gwiazdozbioru; wtedy obie biblioteki linkują się nawzajem            |
| Profil celu: zdanie „po czym poznać"                                 | brak w katalogu                                                                           | **DO ZROBIENIA (dane)**: opis na obiekt                                                            |
| Profil celu: najlepszy miesiąc, wysokość w górowaniu                 | makieta liczy przybliżenie z projektu                                                     | **DO ZROBIENIA**: funkcja w `sky-targets` zamiast rachunku w widoku                                |
| Biblioteka gwiazdozbiorów: galeria, szukanie bez ogonków             | `CONSTELLATIONS`                                                                          | jest                                                                                               |
| Rysunek gwiazdozbioru                                                | `src/mock/constellation-figures.ts` ma schematyczne współrzędne                           | **DO ZROBIENIA (dane)**: pole `figure` z RA/dec z katalogu jasnych gwiazd (offline, jak `sky-map`) |
| „Jak widzisz teraz" — obrót jak nad horyzontem                       | `skyPathOverNight` daje wysokość i azymut                                                 | **DO ZROBIENIA**: kąt obrotu figury (kąt paralaktyczny) dla miejsca i godziny                      |
| „Podążaj za telefonem" (żyroskop)                                    | brak `expo-sensors`                                                                       | **DO ZROBIENIA**: zależność + orientacja urządzenia                                                |

Po etapie usuwamy `app/legacy/settings.tsx` i `app/legacy/night.tsx`.

### Etap 9 — Tryb czerwony

| Element                                                | Źródło                                              | Status                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Paleta czerwona                                        | `theme.redColors` (dodana z projektu)               | jest                                                                                        |
| Przełączanie palety w całej aplikacji                  | `colors` to stała importowana w każdym `StyleSheet` | **DO ZROBIENIA**: kontekst motywu (`useTheme`) i przepięcie stylów — największa praca etapu |
| Drugi nośnik znaczenia: ✓ ! × · zamiast koloru         | `src/ui/kit` ma znaki w części klocków              | **UI**: dokończyć we wszystkich stanach                                                     |
| Jasność ekranu w arkuszu                               | brak `expo-brightness`                              | **DO ZROBIENIA**: zależność                                                                 |
| Trzy palce otwierają arkusz z każdego ekranu           | brak obsługi gestów wielodotyku                     | **DO ZROBIENIA**: `react-native-gesture-handler` albo własny responder na korzeniu          |
| „Włączaj sam po zmierzchu"                             | `night-window` daje zmierzch                        | **DO ZROBIENIA**: pole w ustawieniach                                                       |
| Zdjęcia wyłączone w trybie czerwonym (APOD, miniatury) | —                                                   | **UI**                                                                                      |

### Etap 10 — Sprzątanie

Usunąć `src/mock/`, `app/mock-states.tsx`, `app/legacy/`, wiersze „Makieta" w Więcej, nieużywane
komponenty z `src/components`. `grep -rn "todo(" app src` ma zwrócić pusto.

## Zbiorczo: czego brakuje poza widokiem

| #   | Brak                                                                                           | Etap |
| --- | ---------------------------------------------------------------------------------------------- | ---- |
| 1   | ~~Zdanie werdyktu w aplikacji~~ — zrobione: `session-text.narrateVerdict`                      | 1    |
| 2   | ~~Treść ostatniego błędu w `ForecastState`~~ — już było: `cycle.lastError`                     | 1    |
| 3   | ~~Ręczne odświeżenie prognozy~~ — już było; dodana blokada 30 min po 429 (`rateLimitCooldown`) | 1    |
| 4   | ~~Opady w godzinach prognozy~~ — już były w `NightHour`                                        | 2    |
| 5   | Powód przerwania nocy w `NightLog`                                                             | 3    |
| 6   | Udostępnianie eksportu (`expo-sharing`)                                                        | 3    |
| 7   | Godzina odhaczenia celu (`seenAt`)                                                             | 4    |
| 8   | Cele dopisane ręcznie do planu nocy                                                            | 4    |
| 9   | Notatki przy miejscówce (do sprawdzenia)                                                       | 6    |
| 10  | Pobranie prognozy tylko dla brakujących miejsc                                                 | 6    |
| 11  | Rezerwacja nocy zjawiska bez planu — decyzja                                                   | 7    |
| 12  | Wyciszanie pojedynczego zjawiska                                                               | 7    |
| 13  | Kategorie powiadomień                                                                          | 7    |
| 14  | Pora przeglądu zjawisk (do sprawdzenia)                                                        | 7    |
| 15  | Lista prognoz w pamięci                                                                        | 8    |
| 16  | Gwiazdozbiór i opis przy obiekcie głębokiego nieba                                             | 8    |
| 17  | Najlepszy miesiąc i górowanie jako funkcja domeny                                              | 8    |
| 18  | Prawdziwe kształty gwiazdozbiorów (`figure`)                                                   | 8    |
| 19  | Kąt obrotu gwiazdozbioru nad horyzontem                                                        | 8    |
| 20  | Żyroskop (`expo-sensors`)                                                                      | 8    |
| 21  | Kontekst motywu dla trybu czerwonego                                                           | 9    |
| 22  | Jasność ekranu (`expo-brightness`)                                                             | 9    |
| 23  | Gest trzech palców                                                                             | 9    |
| 24  | Automatyczny tryb czerwony po zmierzchu                                                        | 9    |

## Otwarte pytania z projektu

- Czy „+3" w selektorze nocy rozwija arkusz z listą nocy, czy przewija dalej.
- Czy tryb sesji (nocleg w terenie) zasługuje na własny segment Planu.
- Powrót do zakładki Noc kasuje drill-down, ale zachowuje wybrany segment i noc.
- Czy przy zamykaniu nocy proponować wyjście z trybu czerwonego.
- Ranking w Gdzie: wynik po karze czy ocena 1–5; miejscowość z Nocy w rankingu czy nie.
