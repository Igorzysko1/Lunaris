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

**Stan: podpięte w kodzie 15 września 2026, bez commita — czeka na przejście na telefonie.**
Dane: `src/hooks/use-journal.ts` (dziennik z dysku, odświeżany po każdym zapisie),
`use-night-log.ts` (noc i cele arkusza), `use-retry-tonight.ts`; rachunek w `src/lib/journal.ts`,
zdania w `src/lib/journal-text.ts` (test: `tests/night-log.test.ts`). Usunięte `app/journal.tsx`
i `src/mock/journal.ts`.

| Element                                                            | Źródło                                                                                       | Status                                                                                                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arkusz „Jak było?": cele tej nocy, trzy stany, dwie skale, notatka | `useNightLog` (`nightTargetsForProfiles` → `visibleOnce` → `orderByHistory`), `saveNightLog` | podpięte — pięć celów z góry listy, ‹ › cofa do 14 dni wstecz, szkic zapisuje się przy każdej zmianie                                                   |
| „Dopisz, co doszło"                                                | reszta celów w zasięgu tej nocy                                                              | podpięte — rozwijana lista, dotknięcie dopisuje cel jako widziany; obiekty spoza zasięgu zostają w bibliotece celów (etap 8)                            |
| Powód „nie wyszło"                                                 | `TargetObservation.reason`, `FAILURE_REASONS`, `customReasons`                               | podpięte — dziennik w wersji 2, zapis v1 wczytuje się bez zmian; własne powody wracają w podpowiedziach                                                 |
| Propozycja korekty progu rosy                                      | `dewThresholdSuggestion`, `config.conditions.dewWarningSpreadC`                              | podpięte — gdy cel przepadł przez rosę, a prognoza nie schodziła poniżej progu; jedno dotknięcie podnosi próg, tylko dla nocy wciąż obecnej w prognozie |
| Historia pogrupowana miesiącami                                    | `useJournal`, `logsByMonth`, `entryChips`, `ratingsLabel`                                    | podpięte                                                                                                                                                |
| Podsumowanie roku: noce / widziane / nie wyszło                    | `yearStats`                                                                                  | podpięte                                                                                                                                                |
| „Dziś lepiej niż wtedy"                                            | `useRetryTonight` (`orderByHistory` → `retry`)                                               | podpięte — wiersz znika, gdy nie ma celu do drugiego podejścia                                                                                          |
| Wpis nocy: cele, oceny, powód z warunkami, notatka                 | `failureWhy`, `targetLabel`                                                                  | podpięte                                                                                                                                                |
| Przebieg nocy i „Popraw godziny"                                   | `setStepTimes`, `plannedStep`, `timeOnNight`, `saveTimeline`                                 | podpięte — godziny wpisuje się z klawiatury, także niezmierzone kroki; wszystkie zmiany sprawdzane naraz (po kolei, nie w przyszłości)                  |
| „Edytuj" — ten sam arkusz na wpisie                                | `close-night?id=…`, `nightLogId`                                                             | podpięte — jedna noc = jeden wpis; warunki podejść zostają z pierwszego zapisu                                                                          |
| Chip „zwinąłem — rosa"                                             | `packedUp`                                                                                   | podpięte — bez nowego pola: „zwinąłem" przy celach plus najczęstszy inny powód tej nocy                                                                 |
| Eksport dziennika                                                  | `exportJournalToFile`                                                                        | podpięte (plik JSON w dokumentach telefonu); **DO ZROBIENIA**: „udostępnij" wymaga `expo-sharing` — moduł natywny, czyli nowego buildu aplikacji        |

Etap 4 dołożył odhaczenie z panelu celu w trakcie nocy (`seenAt`), zapisywane do tego samego
szkicu wpisu. Propozycja progu rosy dalej nie mówi „o godzinę": godzinę niesie tylko widziany cel,
a nie nieudane podejście.

### Etap 4 — Noc › Niebo i panel celu

| Element                                          | Źródło                                                                      | Status                                                                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cele w zasięgu posortowane oknem, wysokość maks. | `night-sky.skyList` (wybór `rankedTargets`, kolejność oknem), `useNightSky` | podpięte — w oknie sesji, przy „odpuść" w całej nocy astronomicznej, z maską horyzontu; bursztyn, gdy cel pokrywa się z oknem na mniej niż połowę                               |
| Przełącznik zestawu optyki                       | `config.opticsProfiles`, `optics.profileLabel`                              | podpięte — „zmień" dopiero przy dwóch zestawach                                                                                                                                 |
| Znacznik „1. RAZ"                                | `night-sky.isFirstTime` (`journal.historyOf`)                               | podpięte — bez znacznika przy pustym dzienniku i przy planetach                                                                                                                 |
| „3 cele poza zasięgiem" + lista                  | `night-sky.outOfReach`, `sky-targets.describeOutOfReach`                    | podpięte — bez celów, które nie wschodzą; rozwija 12, resztę pokazuje biblioteka                                                                                                |
| Chip „Następny event" → Kalendarz › Eventy       | `night-sky.nextVisibleEvent`, `sky-text.describeEventWhen`                  | podpięte — najbliższe widoczne zjawisko                                                                                                                                         |
| Gwiazdozbiory nad horyzontem (≥ 20°)             | `constellations.constellationsTonight`, `useConstellationTonight`           | podpięte — najwyższe położenie w wybranej nocy zamiast „teraz", bo segment idzie za selektorem nocy; 8 żetonów; panel gwiazdozbioru mówi „gdzie szukać" z `describeWhereToLook` |
| Panel celu: widoczność, profil wysokości, azymut | `sky-targets.targetTonight`, `altitudesOf`, `night-sky.fullHours`           | podpięte — jeden cel tym samym rachunkiem co lista                                                                                                                              |
| Panel celu: historia zobaczeń                    | `journal.describeHistory`, `journal-text.sightingsOf`                       | podpięte — z nieudanymi podejściami                                                                                                                                             |
| „Widziałem — 23:04" (odhaczenie w trakcie nocy)  | `TargetObservation.seenAt`, `journal.withSighting`, `withoutSighting`       | podpięte — dziennik v3; odhaczenie od zachodu do wschodu Słońca, od razu do szkicu wpisu; „cofnij" usuwa pusty wpis                                                             |
| „Dopisz do planu tej nocy"                       | `night-picks`, `useNightPicks` (`lunaris.night-picks`)                      | podpięte w Niebie i w celach Planu; do opisu rezerwacji dojdzie w etapie 5                                                                                                      |

Cele Planu („kolejność z segmentu Niebo") biorą już tę samą listę. Stałe Nieba i panelu celu
zniknęły z `src/mock/night.ts`; zostały tylko Plan, noc w trakcie i ostrzeżenie rezerwacji.

### Etap 5 — Noc › Plan i rezerwacja

| Element                                                                         | Źródło                                                                                   | Status                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Przebieg nocy: bloki dojazd / sesja / powrót / sen, kroki od wyjazdu do pobudki | `plan-text.planSchedule` z `PlannedNight`, `useNightPlan`                                | podpięte — bez punktu startowego plan nie udaje drogi („wyjazd", „koniec wyjazdu"); ostatni krok to pobudka z planu, a nie „zakładany początek dnia" z projektu |
| Sen, min. temperatura, odczuwalna                                               | `planSchedule` (`minTemperature`, `feltTemperature`, `sleepHours`)                       | podpięte — odczuwalna tylko przy różnicy ≥ 1 °C, sen bursztynowy przy „śnie na styk"                                                                            |
| Ostrzeżenia                                                                     | `session-text.describeWarning`                                                           | podpięte — dosłownie; ton z rodzaju ostrzeżenia, trzecia doba jako uwaga                                                                                        |
| Zarezerwuj / Zaktualizuj wpis / Odwołaj sesję                                   | `useBooking` (logika z `BookingButtons`), `bookingFor`, `upsertBooking`, `deleteBooking` | podpięte — wpis obejmuje cały wyjazd; odwołanie pyta jeszcze raz                                                                                                |
| Brak konta Google → „Połącz Kalendarz Google"                                   | `useGoogle`                                                                              | podpięte — łączy od razu z Planu; bez logowania w środowisku (Expo Go) przycisków nie ma                                                                        |
| Noc w trakcie: odhaczenia, „co dalej dziś", „zapisz noc"                        | lista Nieba z `seenAt`, `plan-text.tonightAhead`, `sky-text.describeSettingSoon`         | podpięte — „zachodzi za 2 h 1 min — teraz albo nigdy" od 150 min przed zachodem                                                                                 |
| Przebieg w terenie: wyjazd, na miejscu, zwijanie, w domu                        | `useSessionTimeline`                                                                     | podpięte — przeniesione ze starej Nocy; zapis powiadamia Dziennik, godziny idą do wpisu w kalendarzu                                                            |
| Cele dopisane do planu w opisie rezerwacji                                      | lista Nieba (`night-picks`) → `bookingFor({ targets })`                                  | podpięte — bez zmiany `planNights`                                                                                                                              |
| „Ta noc nie przechodzi już progów, a jej rezerwacja wciąż jest w kalendarzu."   | `fetchBooking` + `bookingFor` → `null`                                                   | było w `BookingButtons` — przeniesione                                                                                                                          |
| Tryb sesji (nocleg w terenie)                                                   | `config.session.overnight`                                                               | jest w silniku; otwarte pytanie projektu o osobny segment — widok bez zmian                                                                                     |

Usunięte: sekcja „Nadchodzące sesje" ze starej Nocy, `src/components/{BookingButtons,SessionTimeline,session-cards}.tsx`,
`src/mock/night.ts` i przełącznik makiety „Kalendarz Google". Zostaje przełącznik „noc w trakcie".

### Uzupełnienia z pełnego pliku projektu (tury 2–6)

Pierwsza wersja planu powstała z pliku uciętego po turze 6. Te pozycje doszły po lekturze całości
i należą do etapów w nawiasach.

| Element                                                                                    | Źródło                                                                          | Status                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| (1) Stan „ODPUŚĆ · 1/5": pasek zakreskowany w całości, zdanie z liczbami, żetony           | `evaluateNight` → `Rejection`, `session-text.rejectionLabels`, `narrateVerdict` | podpięte (etap 1)                                                                                                                     |
| (1) Żeton „czwartek 4/5 ›" — najbliższa dobra noc                                          | `useNightVerdicts.bestNight`                                                    | podpięte w zakresie 3 nocy (etap 1)                                                                                                   |
| (2) Karta seeing tylko przy teleskopie, przy lornetce żeton w werdykcie                    | `night-conditions.seeingProfile`, `seeing.seeingCanLimit`                       | podpięte (etap 2) — z powiększenia zestawu (≥ 80x), bez nowego pola w profilu                                                         |
| (3) Trzy stany celu w arkuszu: puste / widziałem / nie wyszło                              | `Outcome = 'seen' \| 'failed'`                                                  | podpięte (etap 3)                                                                                                                     |
| (3) Powód „nie wyszło" z listy: rosa · chmury · zmęczenie · sprzęt · zwinąłem · inne       | `TargetObservation.reason`, `customReasons`                                     | podpięte (etap 3) — dziennik v2                                                                                                       |
| (3) „Rosa wyprzedziła prognozę o godzinę. Podnieść próg zapasu do 3 K?"                    | `dewThresholdSuggestion`                                                        | podpięte (etap 3) — bez „o godzinę", bo godzinę niesie tylko odhaczenie widzianego (`seenAt`), a nie nieudane podejście               |
| (3) Szkic wpisu istnieje od pierwszego odhaczenia i przeżywa zamknięcie arkusza            | `saveNightLog` przy każdej zmianie w arkuszu                                    | podpięte (etap 3) — odhaczenia z panelu celu trafiają do tego samego szkicu (etap 4)                                                  |
| (4) Panel celu poza sesją: „Pokrywa się z oknem tylko na 2 h 30 min"                       | `sky-text.describeShortOverlap`                                                 | podpięte (etap 4) — zdanie mówi też, co zrobić: złapać na początku, zostawić na koniec                                                |
| (4) „W tym zestawie: pow. 81× okularem 25 mm · pole 36′"                                   | `sky-text.describeOpticsReach`                                                  | podpięte bez okularu (etap 4) — profil zna powiększenie i pole, nie okular; **DO ZROBIENIA** w etapie 8, jeśli okular ma być widoczny |
| (4) Pusta historia: „Jeszcze nie widziany. Po zapisaniu nocy pojawi się tu pierwszy wpis." | `journal-text.sightingsOf`                                                      | podpięte (etap 4)                                                                                                                     |
| (5) „Ta noc nie przechodzi już progów, a jej rezerwacja wciąż jest w kalendarzu."          | `fetchBooking` + `bookingFor` → `null`                                          | podpięte (etap 5) — wykrycie było już w `BookingButtons`                                                                              |
| (9) Zasięg trzystanowy w trybie czerwonym: w zasięgu / graniczny / poza                    | `sky-targets.libraryReachLevel`, próg `MARGINAL_MAG`                            | podpięte (etap 9) — „poza" znaczy to samo co werdykt dwustanowy, doróbką jest środek: zapas mniejszy niż 0,5 mag                      |

Rozstrzygnięcie projektu: Dziennik bez segmentów (tura 14) zastępuje „Dziennik › Ta noc / Miesiąc /
Historia" z tury 4c; zapisany wpis czyta się jako Wpis nocy (14b).

### Etap 6 — Gdzie

| Element                                                                      | Źródło                                                                                | Status                                                                                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Ranking: warte rozważenia / zdominowane / odpada / bez prognozy              | `site-review.reviewNights`, `useRanking` (`use-where`)                                | podpięte — miejsce wybrane w Nocy wchodzi jako zwykły wiersz (decyzja 15 września), z prognozą cyklu Nocy, oznaczone „w Nocy" |
| Duża liczba w wierszu                                                        | `SiteOutlook.score`                                                                   | podpięte — wynik po karze 0–100 (decyzja 15 września), obok `explainScore`                                                    |
| „Tylko stąd: M33, NGC 7000"                                                  | `SiteOutlook.uniqueTargets` → `where-text.uniqueText`                                 | podpięte                                                                                                                      |
| „noc: dziś ▾"                                                                | `reviewNights` dla kolejnych nocy                                                     | podpięte — dotknięcie przełącza na kolejną noc                                                                                |
| Katalog z Bortle i dojazdem                                                  | `config.sites`, `sky-map.skyQualityAt`, `astro.distanceKm`, `where-text.driveMinutes` | podpięte                                                                                                                      |
| „Jestem tutaj": fix GPS z dokładnością, nowe miejsce / korekta współrzędnych | `capturePosition`, `addSiteAt`, `moveSite` (`useSiteCatalog`)                         | podpięte — nowe miejsce od razu wybrane w Nocy; do korekty trzy najbliższe fixowi                                             |
| Szczegół: horyzont, przeszkody, „usuń"                                       | `addHorizonOverride`, `removeHorizonOverride`, `where-text.parseObstacle`             | podpięte — azymuty 0–360 (także przez północ), wysokość 0–90                                                                  |
| Szczegół: notatki z wyjazdów                                                 | `ObservingSite.notes`, `updateSiteNotes`                                              | było — pole istniało; zapis po zakończeniu edycji                                                                             |
| „Obserwuj stąd tej nocy"                                                     | `selectPlace`                                                                         | podpięte — przechodzi do Nocy                                                                                                 |
| „Nawiguj ↗"                                                                  | `where-text.navigationUrl` + `Linking`                                                | podpięte — adres Google Maps                                                                                                  |
| „Usuń miejsce"                                                               | `removeSite`                                                                          | podpięte — pyta; przy miejscu liczonym w Nocy uprzedza, że Noc wróci do domyślnej miejscowości                                |
| „Pobierz prognozę dla tych dwóch"                                            | `useSiteReview.fetchMissing` (`fetchUpcomingNightsForPoints`)                         | podpięte — tylko brakujące punkty, 30 min blokady po 429; w hooku przeglądu, nie w `ForecastProvider`                         |
| Mapa zanieczyszczenia światłem ↗                                             | `lightPollutionMapUrl`                                                                | podpięte                                                                                                                      |

Usunięte: `app/sites.tsx`, `app/review.tsx`, `src/mock/where.ts`. Zdania i walidacja w
`src/lib/where-text.ts` (test: `tests/where-text.test.ts`).

### Etap 7 — Kalendarz, Eventy, powiadomienia

| Element                                                          | Źródło                                                                               | Status                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Siatka miesiąca, kropki, nawigacja ‹ ›                           | `useCalendarTab` (`useCalendarMonth`, `monthCells`, `eventsOnDay`)                   | podpięte                                                                                               |
| Propozycja sesji z ✓                                             | `unbookedNights`, `upsertBooking`                                                    | podpięte — ten sam identyfikator co rezerwacja z Planu                                                 |
| Edycja godzin po kwadransie, notatka, Zapisz/Usuń                | `useObservationEditor`, `checkObservationTimes`, `patchObservation`, `deleteBooking` | podpięte                                                                                               |
| Dzień dzisiejszy → „Idź do Nocy"                                 | nawigacja                                                                            | podpięte                                                                                               |
| Eventy: 60 dni, granica prognozy, werdykt nocy                   | `upcomingEvents`, `event-review.eventOutlook`, `calendar-text.eventChips`            | podpięte — powód milczenia pod opisem                                                                  |
| Szczegół zjawiska: stan, Księżyc, ZHR, kiedy się odezwie         | `eventStatus`, `eventFacts`, `notifyText` z planu ostatniego przeglądu               | podpięte                                                                                               |
| „Zarezerwuj tę noc" dla zjawiska poza prognozą                   | `session-booking.previewBookingFor`, `useBookingEntry`                               | podpięte — wstępny wpis na całą noc (decyzja 15 września), ten sam identyfikator co rezerwacja z Planu |
| „Wycisz to zjawisko"                                             | `notice-store.loadMutedEvents`, `saveMutedEvents`, `reviewEvents({ muted })`         | podpięte — przegląd rusza od razu, bez sieci                                                           |
| Powiadomienia: wyprzedzenie                                      | `settings.leadTime`, `LEAD_TIMES`                                                    | podpięte — dotknięcie przełącza na kolejne                                                             |
| Powiadomienia: zaplanowane i przemilczane z powodem              | `useForecast().notices`, `eventOutlook` → `silenceText`                              | podpięte — przemilczane z najbliższych dwóch tygodni                                                   |
| Kategorie: zaćmienia, roje, koniunkcje i opozycje, fazy Księżyca | `PersistedSettings.notifyCategories`, `event-review.categoryOf`                      | podpięte — domyślnie bez faz Księżyca                                                                  |
| Pora przeglądu                                                   | `config.refresh.hourOfDay`                                                           | podpięte — ta sama godzina co odświeżanie prognozy (decyzja 15 września)                               |
| „Pokaż Oriona"                                                   | `calendar-text.showTargetFor`                                                        | podpięte — gwiazdozbiór radiantu, planeta w opozycji albo Księżyc                                      |

Poprawiony błąd cyklu: plan powiadomień liczył się tylko ze zgłoszeń nowych w danym przeglądzie,
więc `reconcile` odwoływał w systemie zapowiedzi zaplanowane dzień wcześniej. Przegląd oddaje teraz
też `pending` (pamiętane w `NoticeLog`) i rusza po każdej nowej prognozie oraz po zmianie kategorii,
wyprzedzenia albo wyciszeń. Usunięte: `app/legacy/calendar.tsx`, `app/legacy/events.tsx`,
`src/components/calendar-cards.tsx`, `src/mock/calendar.ts`. Test: `tests/calendar-text.test.ts`.

### Etap 8 — Więcej, nastawy, biblioteki

| Element                                                              | Źródło                                                                        | Status                                                                                                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Menu z bieżącą wartością w drugiej linijce                           | `useMore`                                                                     | podpięte                                                                                                                                |
| Podstrony: Sprzęt, Profil obserwatora, Kalendarz Google, Lokalizacja | `app/settings/{equipment,observer,google,location}.tsx`, `useCalendarChoices` | podpięte — rozbite ze starych Ustawień; tryb sesji w Profilu obserwatora                                                                |
| Zdjęcie dnia NASA                                                    | `app/apod.tsx`, `useApod`, `ApodCard`                                         | podpięte                                                                                                                                |
| Źródła danych i o aplikacji                                          | `app/about.tsx`                                                               | podpięte                                                                                                                                |
| Prognozy w pamięci: ile miejsc, wiek                                 | `forecast-cache.summarizeForecasts`, `listForecasts`, `app/forecasts.tsx`     | podpięte — razem ze stanem pobierania ze starych Ustawień                                                                               |
| Eksport dziennika                                                    | `exportJournalToFile`                                                         | podpięte — plik JSON; udostępnianie dalej czeka na `expo-sharing`                                                                       |
| Biblioteka celów: szukanie, filtry, „tylko w zasięgu"                | `useTargetLibrary`, `sky-targets.libraryReach`                                | podpięte — ten sam rachunek zasięgu co w Niebie, dla wszystkich zestawów pod niebem aktywnego miejsca                                   |
| Profil celu: „czy to zobaczysz" z powodem                            | `libraryReach`, `sky-library.describeLibraryReach`                            | podpięte — osobno dla każdego zestawu                                                                                                   |
| Profil celu: macierzysty gwiazdozbiór                                | `sky-library.constellationOf` (granice IAU z Astronomy Engine)                | podpięte — bez pola w katalogu; obie biblioteki linkują się nawzajem                                                                    |
| Profil celu: zdanie „po czym poznać"                                 | brak w katalogu                                                               | **DO ZROBIENIA (dane)**: decyzja 15 września — bez opisu, dopóki nie będzie sprawdzony                                                  |
| Profil celu: najlepszy miesiąc, wysokość w górowaniu                 | `sky-library.bestMonth`, `culminationAltitude`                                | podpięte — z położenia Słońca i szerokości aktywnego miejsca                                                                            |
| Profil celu: historia i „Dopisz do planu tej nocy"                   | `describeHistory`, `togglePlanPick`                                           | podpięte                                                                                                                                |
| Biblioteka gwiazdozbiorów: galeria, szukanie bez ogonków             | `useConstellationLibrary`, `sky-library.foldForSearch`                        | podpięte                                                                                                                                |
| Panel gwiazdozbioru: obiekty w jego granicach                        | `sky-library.objectsInConstellation`                                          | podpięte — zamiast listy z makiety                                                                                                      |
| Rysunek gwiazdozbioru                                                | `src/mock/constellation-figures.ts` (schematyczne)                            | **DO ZROBIENIA (dane)**: decyzja 15 września — zostają schematyczne; pole `figure` z RA/dec z katalogu jasnych gwiazd na osobne zadanie |
| „Jak widzisz teraz" — obrót jak nad horyzontem                       | `sky-library.skyOrientation` (kąt paralaktyczny)                              | podpięte — dla środka gwiazdozbioru; pod horyzontem ułożenie z najwyższego położenia tej nocy                                           |
| „Podążaj za telefonem" (żyroskop)                                    | `expo-sensors` `DeviceMotion`, `useDeviceRoll`                                | podpięte w kodzie (decyzja 15 września) — moduł natywny, zadziała po nowym buildzie; kierunek obrotu do sprawdzenia na telefonie        |

Usunięte: `app/legacy/settings.tsx`, `app/legacy/night.tsx` i `app/legacy/index.tsx`. Nieużywane już
komponenty (`night-cards`, `CloudCoverChart`, `EventCard`) sprząta etap 10. Test:
`tests/sky-library.test.ts`.

### Etap 9 — Tryb czerwony

| Element                                                | Źródło                                                   | Status                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Paleta czerwona                                        | `PALETTES.red` w `theme.ts`                              | podpięte (etap 9) — pełna paleta, nie trzy kolory: tony znaczeniowe schodzą w niej do jednej barwy                           |
| Przełączanie palety w całej aplikacji                  | `ThemeProvider` i `themedStyles` (`src/ui/theme.tsx`)    | podpięte (etap 9) — `colors` czyta paletę bieżącą, arkusz powstaje leniwie, a drzewo ekranów montuje się od nowa             |
| Drugi nośnik znaczenia: ✓ ! × · zamiast koloru         | `kit.toneMark`, znaki zasięgu w bibliotece               | podpięte (etap 9) — żeton z tonem niesie znak w obu paletach, nie tylko w czerwonej                                          |
| Jasność ekranu w arkuszu                               | `expo-brightness` → `lib/screen-brightness.ts`           | podpięte (etap 9) — **wymaga nowego builda deweloperskiego**; bez niego tryb działa bez sterowania jasnością                 |
| Trzy palce otwierają arkusz z każdego ekranu           | responder przechwytujący na korzeniu (`app/_layout.tsx`) | podpięte (etap 9) — bez biblioteki gestów; `false` znaczy „nie przejmuję", więc gest nie odbiera dotknięć niczemu pod spodem |
| „Włączaj sam po zmierzchu"                             | `currentNightWindow` + `theme.auto` w ustawieniach (v4)  | podpięte (etap 9) — ręczne wskazanie trybu wyłącza automat                                                                   |
| Zdjęcia wyłączone w trybie czerwonym (APOD, miniatury) | `useTheme().red` w `ApodCard`                            | podpięte (etap 9) — APOD jest jedynym zdjęciem w aplikacji                                                                   |

### Etap 10 — Sprzątanie

Zrobione (etap 10). Usunięte: `src/mock/` (cały katalog), `app/mock-states.tsx` z wpisem w nawigacji,
grupa „Makieta" w Więcej, przełącznik `useMock`/`MockProvider` wraz z wymuszaniem nocy w trakcie
w Nocy i w panelu celu, `kit.todo()` oraz nieużywane komponenty `CloudCoverChart`, `EventCard`
i `night-cards`. `app/legacy/` zniknęło już w etapie 8.

Dwie rzeczy zostały świadomie. Figury gwiazdozbiorów przeniosły się do `src/data/constellation-figures.ts`
— są danymi, nie makietą; schematyczne współrzędne to osobne zadanie (wiersz 18 niżej), a nie pozostałość
po makiecie. `src/components/primitives.tsx` zostaje, bo używają go Lokalizacja i karta APOD.

Noc w trakcie rozstrzyga teraz wyłącznie zegar: `moment.live` w Nocy i `checkOffOpen` w panelu celu.
Odpadło z tym pole `currentNight` z `use-target-panel`, istniejące tylko dla przełącznika makiety.

`grep -rn "todo(" app src` i `grep -rin "makiet\|mock" app src` zwracają pusto.

## Zbiorczo: czego brakuje poza widokiem

| #   | Brak                                                                                                 | Etap |
| --- | ---------------------------------------------------------------------------------------------------- | ---- |
| 1   | ~~Zdanie werdyktu w aplikacji~~ — zrobione: `session-text.narrateVerdict`                            | 1    |
| 2   | ~~Treść ostatniego błędu w `ForecastState`~~ — już było: `cycle.lastError`                           | 1    |
| 3   | ~~Ręczne odświeżenie prognozy~~ — już było; dodana blokada 30 min po 429 (`rateLimitCooldown`)       | 1    |
| 4   | ~~Opady w godzinach prognozy~~ — już były w `NightHour`                                              | 2    |
| 5   | ~~Powód przerwania nocy w `NightLog`~~ — wynika z powodów celów (`packedUp`), bez osobnego pola      | 3    |
| 6   | Udostępnianie eksportu (`expo-sharing`) — moduł natywny, wymaga nowego buildu                        | 3    |
| 7   | ~~Godzina odhaczenia celu~~ — zrobione: `TargetObservation.seenAt`, dziennik v3                      | 4    |
| 8   | ~~Cele dopisane ręcznie do planu nocy~~ — zrobione: `night-picks`, w opisie rezerwacji z listy Nieba | 4–5  |
| 9   | ~~Notatki przy miejscówce~~ — już były: `ObservingSite.notes`                                        | 6    |
| 10  | ~~Pobranie prognozy tylko dla brakujących miejsc~~ — zrobione: `useSiteReview.fetchMissing`          | 6    |
| 11  | ~~Rezerwacja nocy zjawiska bez planu~~ — wstępny wpis na całą noc (`previewBookingFor`)              | 7    |
| 12  | ~~Wyciszanie pojedynczego zjawiska~~ — zrobione: `loadMutedEvents`, `reviewEvents({ muted })`        | 7    |
| 13  | ~~Kategorie powiadomień~~ — zrobione: `notifyCategories`, `categoryOf`                               | 7    |
| 14  | ~~Pora przeglądu zjawisk~~ — ta sama co odświeżanie prognozy                                         | 7    |
| 15  | ~~Lista prognoz w pamięci~~ — zrobione: `summarizeForecasts`                                         | 8    |
| 16  | ~~Gwiazdozbiór przy obiekcie~~ z granic IAU; opis „po czym poznać" czeka na sprawdzone dane          | 8    |
| 17  | ~~Najlepszy miesiąc i górowanie jako funkcja domeny~~ — zrobione: `sky-library`                      | 8    |
| 18  | Prawdziwe kształty gwiazdozbiorów (`figure`) — decyzja: osobne zadanie                               | 8    |
| 19  | ~~Kąt obrotu gwiazdozbioru nad horyzontem~~ — zrobione: `skyOrientation`                             | 8    |
| 20  | Żyroskop (`expo-sensors`) — dodany; działa po nowym buildzie                                         | 8    |
| 21  | ~~Kontekst motywu dla trybu czerwonego~~ — zrobione: `ThemeProvider`, `themedStyles`                 | 9    |
| 22  | ~~Jasność ekranu (`expo-brightness`)~~ — dodana; działa po nowym buildzie                            | 9    |
| 23  | ~~Gest trzech palców~~ — zrobione: responder przechwytujący na korzeniu                              | 9    |
| 24  | ~~Automatyczny tryb czerwony po zmierzchu~~ — zrobione: `theme.auto` + okno nocy                     | 9    |

## Otwarte pytania z projektu

- Czy „+3" w selektorze nocy rozwija arkusz z listą nocy, czy przewija dalej.
- Czy tryb sesji (nocleg w terenie) zasługuje na własny segment Planu.
- Powrót do zakładki Noc kasuje drill-down, ale zachowuje wybrany segment i noc.
- Czy przy zamykaniu nocy proponować wyjście z trybu czerwonego.
- ~~Ranking w Gdzie~~ — rozstrzygnięte 15 września: wynik po karze 0–100, miejscowość z Nocy jako zwykły wiersz.
