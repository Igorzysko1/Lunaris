import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { colors, fonts } from '@/theme';
import { Label, MenuRow, Note, Panel, Screen, TitleBar } from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

/**
 * Źródła danych, na których stoi każdy werdykt.
 *
 * Nie jest to ozdoba ekranu „o aplikacji": Open-Meteo daje dane na CC BY 4.0,
 * a World Atlas i GUGiK to osobne opracowania z własnymi warunkami. Kto po
 * miesiącu zapyta „skąd wiadomo, że tam jest Bortle 4", znajdzie odpowiedź tu.
 */
const DATA_SOURCES = [
  { name: 'Open-Meteo', use: 'prognoza pogody · CC BY 4.0' },
  { name: 'World Atlas 2024', use: 'jasność nieba, skala Bortle’a' },
  { name: 'GUGiK', use: 'model terenu pod maskę horyzontu' },
  { name: 'Astronomy Engine, suncalc', use: 'efemerydy liczone lokalnie' },
  { name: 'NASA APOD', use: 'zdjęcie dnia · prawa przy autorze zdjęcia' },
] as const;

export default function AboutScreen() {
  return (
    <Screen>
      <TitleBar back title="Źródła danych i o aplikacji" />

      <Panel>
        <View style={styles.row}>
          <Text style={styles.title}>Lunaris</Text>
          <Text style={styles.mono}>{Constants.expoConfig?.version ?? '—'}</Text>
        </View>
        <Note>Aplikacja do decyzji, czy i dokąd jechać obserwować niebo.</Note>
      </Panel>

      <Label>Dane</Label>
      <Panel>
        {DATA_SOURCES.map((source) => (
          <View key={source.name} style={styles.row}>
            <Text style={styles.title}>{source.name}</Text>
            <Text style={styles.use}>{source.use}</Text>
          </View>
        ))}
      </Panel>
      <Note>
        Atrybucja Open-Meteo jest warunkiem licencji CC BY 4.0, a nie uprzejmością. Prognoza może
        przychodzić przez serwer pośredni — to te same dane z tego samego źródła.
      </Note>

      <MenuRow
        title="Prognozy w pamięci"
        subtitle="stan pobierania i zapisane prognozy"
        onPress={() => router.push('/forecasts')}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    minHeight: 32,
  },
  title: { fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary },
  use: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
}));
