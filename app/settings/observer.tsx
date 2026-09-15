import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NumberRow } from '@/components/NumberRow';
import { Toggle } from '@/components/Toggle';
import { findPlaceById } from '@/data/places';
import { CONFIG_LIMITS } from '@/lib/config';
import { useSettings } from '@/store/settings';
import { colors, fonts } from '@/theme';
import { Label, MenuRow, Note, Panel, Screen, TitleBar } from '@/ui/kit';

/** Więcej › Profil obserwatora: dom, droga, sen i tryb sesji — wszystko, co zmienia plan nocy. */
export default function ObserverScreen() {
  const { config, updateConfig } = useSettings();
  const { observer, session } = config;
  const limits = CONFIG_LIMITS;
  const home = observer.homePlaceId ? (findPlaceById(observer.homePlaceId)?.name ?? null) : null;

  return (
    <Screen>
      <TitleBar back title="Profil obserwatora" subtitle="zmiana przelicza plan nocy od razu" />

      <MenuRow
        title="Punkt startowy"
        subtitle="stąd liczone są dojazd i powrót"
        value={home ?? 'nie ustawiono'}
        onPress={() => router.push({ pathname: '/location', params: { target: 'home' } })}
      />

      <Label>Droga i sen</Label>
      <Panel>
        <NumberRow
          label="Średnia prędkość"
          unit="km/h"
          value={observer.averageSpeedKmh}
          limits={limits.observer.averageSpeedKmh}
          onCommit={(averageSpeedKmh) => updateConfig('observer', { averageSpeedKmh })}
        />
        <NumberRow
          label="Tolerancja marszu"
          unit="min"
          value={observer.walkToleranceMin}
          limits={limits.observer.walkToleranceMin}
          onCommit={(walkToleranceMin) => updateConfig('observer', { walkToleranceMin })}
        />
        <NumberRow
          label="Minimum snu"
          unit="h"
          value={observer.minSleepHours}
          limits={limits.observer.minSleepHours}
          onCommit={(minSleepHours) => updateConfig('observer', { minSleepHours })}
        />
        <NumberRow
          label="Bufor pobudki"
          unit="min"
          value={observer.wakeBufferMin}
          limits={limits.observer.wakeBufferMin}
          onCommit={(wakeBufferMin) => updateConfig('observer', { wakeBufferMin })}
        />
        <NumberRow
          label="Pakowanie po sesji"
          unit="min"
          value={observer.packUpMin}
          limits={limits.observer.packUpMin}
          onCommit={(packUpMin) => updateConfig('observer', { packUpMin })}
        />
      </Panel>

      <Label>Tryb sesji</Label>
      <Panel>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.title}>Nocleg w terenie</Text>
            <Text style={styles.hint}>
              {session.overnight
                ? 'Powrót rano — godzina powrotu i pobudki nie są liczone.'
                : 'Powrót tej samej nocy — stąd liczenie snu i pobudki.'}
            </Text>
          </View>
          <Toggle
            value={session.overnight}
            onPress={() => updateConfig('session', { overnight: !session.overnight })}
            label="Nocleg w terenie"
          />
        </View>
        <NumberRow
          label="Sesja minimum"
          unit="min"
          value={session.minDurationMinutes}
          limits={limits.session.minDurationMinutes}
          onCommit={(minDurationMinutes) => updateConfig('session', { minDurationMinutes })}
        />
        <NumberRow
          label="Sesja maksimum"
          unit="min"
          value={session.maxDurationMinutes}
          limits={limits.session.maxDurationMinutes}
          onCommit={(maxDurationMinutes) => updateConfig('session', { maxDurationMinutes })}
        />
      </Panel>
      <Note>
        Krótsza sesja to noc odrzucona, dłuższa jest przycinana — jedno i drugie liczone na tym, co
        zostaje po odjęciu snu i drogi, a nie na samym oknie pogodowym.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
