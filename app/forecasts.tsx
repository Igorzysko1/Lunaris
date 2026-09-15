import { StyleSheet, Text, View } from 'react-native';

import { useForecastsInMemory } from '@/hooks/use-more';
import { colors, fonts } from '@/theme';
import { Button, Chip, Label, Note, Panel, Screen, TitleBar } from '@/ui/kit';

/**
 * Więcej › Prognozy w pamięci. Cykl, który po cichu przestał działać, jest gorszy
 * niż jego brak — dlatego obok siebie stoją próba i sukces, a przy nich powód
 * ostatniego niepowodzenia i to, co leży na dysku.
 */
export default function ForecastsScreen() {
  const view = useForecastsInMemory();

  return (
    <Screen>
      <TitleBar back title="Prognozy w pamięci" />

      <Label>Pobieranie</Label>
      <Panel>
        <View style={styles.row}>
          <Text style={styles.title}>Ostatnie pobranie</Text>
          <Text style={styles.mono}>{view.lastSuccess}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.title}>Ostatnia próba</Text>
          <Text style={styles.mono}>{view.lastAttempt}</Text>
        </View>
        {view.lastError ? <Note>{`Powód niepowodzenia: ${view.lastError}`}</Note> : null}
        <Button
          label={view.refreshLabel}
          tone="accent"
          disabled={view.refreshBlocked}
          onPress={view.refresh}
        />
      </Panel>

      <Label right={view.loading ? undefined : String(view.rows.length)}>Zapisane</Label>
      {view.loading ? <Note>Sprawdzam zapis…</Note> : null}
      {!view.loading && view.rows.length === 0 ? <Note>Nic nie leży w pamięci.</Note> : null}
      {view.rows.map((row) => (
        <Panel key={row.key}>
          <View style={styles.row}>
            <Text style={styles.title}>{row.place}</Text>
            <Chip label={row.stale ? 'po terminie' : 'aktualna'} tone={row.stale ? 'warn' : 'go'} />
          </View>
          <Text style={styles.detail}>{row.detail}</Text>
        </Panel>
      ))}
      <Note>
        Zapis starszy niż 48 h wypada przy odświeżaniu — dotyczy nocy, które już minęły. Nazwa
        miejsca to najbliższa miejscowość do zapisanego punktu.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 32,
  },
  title: { flex: 1, fontFamily: fonts.sans, fontSize: 14.5, color: colors.textPrimary },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  detail: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
});
