import { router } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { Toggle } from '@/components/Toggle';
import { lightPollutionMapUrl } from '@/lib/light-pollution';
import { useSettings } from '@/store/settings';
import { colors, fonts } from '@/theme';
import { Button, MenuRow, Note, Notice, Panel, Screen, TitleBar } from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

/** Więcej › Lokalizacja: GPS albo miejscowość wybrana ręcznie — dla niej liczy się Noc. */
export default function LocationSettingsScreen() {
  const { autoLocation, active, placeName, toggleAutoLocation, retryGps } = useSettings();
  const failed = active.gpsStatus === 'denied' || active.gpsStatus === 'unavailable';

  return (
    <Screen>
      <TitleBar back title="Lokalizacja" subtitle={`Noc liczy się dla: ${active.label}`} />

      <Panel>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.title}>Automatyczna (GPS)</Text>
            <Text style={styles.hint}>
              {!autoLocation
                ? 'Wyłączona — liczę dla wybranej miejscowości.'
                : active.gpsStatus === 'loading'
                  ? 'Ustalam pozycję…'
                  : active.source === 'gps'
                    ? `Wykryto: ${active.label}`
                    : 'Brak pozycji'}
            </Text>
          </View>
          <Toggle
            value={autoLocation}
            onPress={toggleAutoLocation}
            label="Automatyczna lokalizacja"
          />
        </View>
      </Panel>

      {autoLocation && failed ? (
        <>
          <Notice tone="bad">
            {active.gpsStatus === 'denied'
              ? `Brak zgody na lokalizację — włącz ją w ustawieniach systemu. Do tego czasu liczę dla: ${active.label}.`
              : `Nie udało się ustalić pozycji. Do tego czasu liczę dla: ${active.label}.`}
          </Notice>
          <Button label="Spróbuj ponownie" tone="accent" onPress={retryGps} />
        </>
      ) : null}

      {!autoLocation ? (
        <MenuRow title="Miejscowość" value={placeName} onPress={() => router.push('/location')} />
      ) : null}

      <MenuRow
        title="Mapa zanieczyszczenia światłem"
        subtitle="gdzie naprawdę jest ciemno w okolicy"
        chevron="↗"
        onPress={() =>
          void Linking.openURL(lightPollutionMapUrl(active.coords.lat, active.coords.lon))
        }
      />
      <Note>Miejscówki z katalogu, z dojściem i notatkami, są w zakładce Gdzie.</Note>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 2,
  },
}));
