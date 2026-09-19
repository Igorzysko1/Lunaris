import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useRanking } from '@/hooks/use-where';
import { nightLogId } from '@/lib/journal';
import { useNightPlace } from '@/store/night-place';
import { colors, fonts } from '@/theme';
import { Body, Label, Note, Panel, Sheet } from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

/**
 * Miejsce, o którym mówi zakładka Noc.
 *
 * Ten arkusz jest rankingiem, a nie listą do przewinięcia: miejsca stoją
 * w kolejności, w jakiej silnik je ocenił na noc, z której go otwarto, razem
 * z powodem.
 * Dzięki temu wybór miejsca i sprawdzenie pogody są jedną czynnością — po to,
 * żeby nie trzeba było chodzić po nią do zakładki Gdzie.
 *
 * „Automatycznie" jest u góry i jest domyślne. Przypięcie zostaje do odwołania,
 * bo powody wyboru gorszego miejsca bywają pozaastronomiczne: znajomi, nocleg,
 * droga, której się nie chce jechać po ciemku.
 */
export default function NightPlaceSheet() {
  const { night } = useLocalSearchParams<{ night?: string }>();
  const { places, reviews, pinnedId, choose } = useNightPlace();

  // Noce łączymy po dacie wieczoru, a nie po pozycji na liście: noce miejsca
  // i noce rankingu nie muszą zaczynać się od tej samej. Gdy ranking tej nocy
  // nie sięga, mówimy to wprost, zamiast po cichu pokazać dzisiejszy.
  const found = night ? reviews.findIndex((r) => nightLogId(r.night.from) === night) : 0;
  const beyond = found < 0;
  const ranking = useRanking(Math.max(0, found));
  const rows = beyond ? [] : [...ranking.go, ...ranking.dominated, ...ranking.noGo];

  // Miejsce tej nocy — zwycięzca jej rankingu albo przypięte.
  const here = beyond
    ? null
    : night
      ? (places.find((p) => nightLogId(p.slice.night.from) === night) ?? null)
      : (places[0] ?? null);

  const pick = (id: string | null) => {
    choose(id);
    router.back();
  };

  return (
    <Sheet
      title="Miejsce nocy"
      subtitle={here ? `tej nocy: ${here.label}` : 'na tę noc brak prognozy'}
    >
      <Panel onPress={() => pick(null)} tone={pinnedId ? undefined : 'accent'} style={styles.row}>
        <Text style={styles.mark}>{pinnedId ? '·' : '✓'}</Text>
        <View style={styles.flex}>
          <Text style={styles.name}>Automatycznie</Text>
          <Text style={styles.meta}>
            {/* Automat bierze zwycięzcę rankingu każdej nocy osobno — więc tu
                stoi zwycięzca tej nocy, której dotyczy lista niżej. */}
            każda noc bierze zwycięzcę swojego rankingu — tej nocy {rows[0]?.name ?? 'brak danych'}
          </Text>
        </View>
      </Panel>

      <Label right={ranking.nightLabel}>Miejsca na tę noc</Label>
      {ranking.loading ? <Note>Liczę oceny miejsc…</Note> : null}
      {beyond ? (
        <Note>
          Na tę noc nie ma jeszcze prognozy miejscówek — ranking sięga tylko kilku nocy naprzód.
        </Note>
      ) : null}

      {rows.map((row) => {
        const chosen = pinnedId === row.id;

        return (
          <Panel
            key={row.id}
            onPress={() => pick(row.id)}
            tone={chosen ? 'accent' : undefined}
            style={styles.row}
          >
            <Text style={[styles.mark, !row.reason && styles.go]}>
              {chosen ? '✓' : row.reason ? '×' : '·'}
            </Text>
            <View style={styles.flex}>
              <View style={styles.between}>
                <Text style={styles.name}>{row.name}</Text>
                <Text style={styles.score}>{row.score}</Text>
              </View>
              <Text style={styles.meta}>
                {row.reason ?? [row.verdict, row.window].filter(Boolean).join(' · ')}
              </Text>
              {row.travel ? <Text style={styles.meta}>{row.travel}</Text> : null}
            </View>
          </Panel>
        );
      })}

      {rows.length === 0 && !ranking.loading ? (
        <Note>
          Nie ma jeszcze prognoz dla miejscówek. Noc pokazuje wtedy twoją pozycję — ranking wejdzie,
          gdy pobierze się prognoza.
        </Note>
      ) : null}

      <Body>{ranking.note}</Body>
    </Sheet>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  mark: { width: 14, fontFamily: fonts.monoSemiBold, fontSize: 14, color: colors.textMuted },
  go: { color: colors.green },
  name: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  score: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.textSecondary },
  meta: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
}));
