import { router } from 'expo-router';
import { View } from 'react-native';

import { useMore } from '@/hooks/use-more';
import { Label, MenuRow, Note, Screen, TitleBar } from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

type Row = { title: string; subtitle?: string; value?: string; chevron?: string; go: () => void };

/**
 * Więcej — kryterium, nie worek: grupy według tego, czy rzecz zmienia werdykt.
 * Każdy wiersz niesie bieżącą wartość w drugiej linijce.
 */
export default function MoreScreen() {
  const more = useMore();

  const groups: { label: string; rows: Row[] }[] = [
    {
      label: 'Co wpływa na werdykt',
      rows: [
        { title: 'Sprzęt', subtitle: more.equipment, go: () => router.push('/settings/equipment') },
        {
          title: 'Progi warunków',
          subtitle: more.thresholds,
          go: () => router.push('/thresholds'),
        },
        {
          title: 'Profil obserwatora',
          subtitle: more.observer,
          go: () => router.push('/settings/observer'),
        },
        {
          title: 'Lokalizacja',
          subtitle: more.location,
          go: () => router.push('/settings/location'),
        },
        {
          title: 'Powiadomienia',
          subtitle: more.notifications,
          go: () => router.push('/notifications'),
        },
        {
          title: 'Kalendarz Google',
          subtitle: more.google,
          go: () => router.push('/settings/google'),
        },
      ],
    },
    {
      label: 'Poza decyzją',
      rows: [
        {
          title: 'Biblioteka celów',
          value: more.libraryTargets,
          go: () => router.push('/library/targets'),
        },
        {
          title: 'Biblioteka gwiazdozbiorów',
          value: more.libraryConstellations,
          go: () => router.push('/library/constellations'),
        },
        { title: 'Zdjęcie dnia NASA', go: () => router.push('/apod') },
        {
          title: 'Tryb nocny',
          subtitle: more.nightMode,
          go: () => router.push('/night-mode'),
        },
      ],
    },
    {
      label: 'Dane',
      rows: [
        {
          title: 'Eksport dziennika',
          subtitle: more.journal,
          chevron: '↓',
          go: () => void more.exportJournal(),
        },
        {
          title: 'Prognozy w pamięci',
          subtitle: more.forecasts,
          go: () => router.push('/forecasts'),
        },
        {
          title: 'Źródła danych i o aplikacji',
          subtitle: more.about,
          go: () => router.push('/about'),
        },
      ],
    },
  ];

  return (
    <Screen>
      <TitleBar title="Więcej" />
      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Label>{group.label}</Label>
          {group.rows.map((row) => (
            <MenuRow
              key={row.title}
              title={row.title}
              subtitle={row.subtitle}
              value={row.value}
              chevron={row.chevron}
              onPress={row.go}
            />
          ))}
          {group.label === 'Dane' && more.exported ? <Note>{more.exported}</Note> : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  group: { gap: 8 },
}));
