import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Label, MenuRow, Screen, TitleBar, todo } from '@/ui/kit';

type Row = { title: string; subtitle?: string; value?: string; go: () => void };

/**
 * Więcej — kryterium, nie worek: trzy grupy według tego, czy rzecz zmienia
 * werdykt. Każdy wiersz niesie bieżącą wartość w drugiej linijce.
 *
 * Wiersze prowadzące do `/legacy/settings` to nastawy, które mają dziś tylko
 * stary ekran Ustawień — każda dostanie własną podstronę przy podpinaniu.
 */
const GROUPS: { label: string; rows: Row[] }[] = [
  {
    label: 'Co wpływa na werdykt',
    rows: [
      {
        title: 'Sprzęt',
        subtitle: 'Lornetka 15x70 · SCT 8″',
        go: () => router.push('/legacy/settings'),
      },
      {
        title: 'Progi warunków',
        subtitle: 'chmury, wiatr, rosa, kara za dojazd',
        go: () => router.push('/thresholds'),
      },
      {
        title: 'Profil obserwatora',
        subtitle: 'Jaworzno · 50 km/h · marsz do 30 min · sen',
        go: () => router.push('/legacy/settings'),
      },
      {
        title: 'Powiadomienia',
        subtitle: 'wieczorem o 18:00, gdy noc wychodzi na „jedź"',
        go: () => router.push('/notifications'),
      },
      {
        title: 'Kalendarz Google',
        subtitle: 'połączony · rezerwacje w „Obserwacje"',
        go: () => router.push('/legacy/settings'),
      },
    ],
  },
  {
    label: 'Poza decyzją',
    rows: [
      { title: 'Biblioteka celów', value: '108', go: () => router.push('/library/targets') },
      {
        title: 'Biblioteka gwiazdozbiorów',
        value: '48',
        go: () => router.push('/library/constellations'),
      },
      { title: 'Zdjęcie dnia NASA', go: () => router.push('/legacy/night') },
    ],
  },
  {
    label: 'Dane',
    rows: [
      {
        title: 'Eksport dziennika',
        subtitle: '14 nocy · JSON, ten sam co na dysku',
        go: () => todo('Eksport dziennika'),
      },
      {
        title: 'Prognozy w pamięci',
        subtitle: '5 miejsc · ostatnia 14 h temu',
        go: () => todo('Podgląd prognoz w pamięci'),
      },
      { title: 'Źródła danych i o aplikacji', go: () => todo('Ekran o aplikacji i źródłach') },
    ],
  },
  {
    label: 'Makieta',
    rows: [
      {
        title: 'Stany makiety',
        subtitle: 'brak prognozy, dane z zapisu, noc w trakcie',
        go: () => router.push('/mock-states'),
      },
      {
        title: 'Tryb nocny',
        subtitle: 'arkusz z trybem czerwonym i jasnością',
        go: () => router.push('/night-mode'),
      },
      {
        title: 'Stare ekrany',
        subtitle: 'Noc, Kalendarz, Eventy i Ustawienia sprzed przebudowy',
        go: () => router.push('/legacy'),
      },
    ],
  },
];

export default function MoreScreen() {
  return (
    <Screen>
      <TitleBar title="Więcej" />
      {GROUPS.map((group) => (
        <View key={group.label} style={styles.group}>
          <Label>{group.label}</Label>
          {group.rows.map((row) => (
            <MenuRow
              key={row.title}
              title={row.title}
              subtitle={row.subtitle}
              value={row.value}
              onPress={row.go}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
});
