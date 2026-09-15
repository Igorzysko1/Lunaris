import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useRanking, useSiteCatalog, type RankRow, type RankingView } from '@/hooks/use-where';
import { colors, fonts } from '@/theme';
import {
  Button,
  Chip,
  ChipRow,
  Field,
  Label,
  MenuRow,
  Note,
  Notice,
  Panel,
  Screen,
  Segments,
  TitleBar,
} from '@/ui/kit';

type Segment = 'ranking' | 'catalog';

const SEGMENTS: readonly (readonly [Segment, string])[] = [
  ['ranking', 'Ranking'],
  ['catalog', 'Katalog'],
];

function openRow(row: RankRow, night: number) {
  // Miejsce z Nocy spoza katalogu nie ma arkusza miejscówki — jego szczegóły to Noc.
  if (row.fromNight) router.navigate('/');
  else router.push({ pathname: '/site/[id]', params: { id: row.id, night: String(night) } });
}

/**
 * Gdzie — „skąd patrzeć?": ranking i katalog to ta sama lista w dwóch porządkach.
 * Ranking liczy `site-review` dla katalogu razem z miejscem wybranym w Nocy;
 * duża liczba to wynik po karze za dojazd, a obok stoi, z czego wyszedł.
 */
export default function WhereScreen() {
  const [segment, setSegment] = useState<Segment>('ranking');
  const [night, setNight] = useState(0);
  const ranking = useRanking(night);

  return (
    <Screen>
      <TitleBar
        title="Gdzie"
        right={segment === 'ranking' ? ranking.nightLabel : undefined}
        onRightPress={
          ranking.nightCount > 1
            ? () => setNight((ranking.nightIndex + 1) % ranking.nightCount)
            : undefined
        }
      />
      <Segments items={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'catalog' ? <Catalog /> : <Ranking ranking={ranking} />}
    </Screen>
  );
}

function Ranking({ ranking }: { ranking: RankingView }) {
  const [showDominated, setShowDominated] = useState(false);
  const night = ranking.nightIndex;

  return (
    <>
      {ranking.status === 'error' ? (
        <Panel tone="bad">
          <Note>
            Nie mam prognozy dla żadnej miejscówki i nie ma zapisu, z którego dałoby się ją
            odtworzyć.
          </Note>
          <Button label="Spróbuj ponownie" tone="accent" onPress={ranking.refresh} />
        </Panel>
      ) : null}
      {ranking.loading ? <Note>Liczę ranking miejscówek…</Note> : null}
      {ranking.stale ? <Notice>{ranking.stale}</Notice> : null}
      <Note>{ranking.note}</Note>
      {ranking.nothingGoes ? <Note>Tej nocy żadne miejsce nie przechodzi progów.</Note> : null}

      {ranking.go.map((row, i) => (
        <Panel key={row.id} onPress={() => openRow(row, night)}>
          <View style={styles.head}>
            <Text style={styles.rank}>{i + 1}</Text>
            <Text style={styles.name}>{row.name}</Text>
            {row.selected ? <Chip label="w Nocy" tone="accent" /> : null}
            <Chip label={`Bortle ${row.bortle}`} />
            <Text style={styles.chevron}>›</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{row.score}</Text>
            <Text style={styles.explain}>{row.explain}</Text>
          </View>
          <ChipRow>
            <Chip label={row.verdict} tone="go" />
            {row.window ? <Chip label={row.window} /> : null}
            {row.travel ? <Chip label={row.travel} /> : null}
          </ChipRow>
          {row.walk ? (
            <Text style={[styles.walk, row.walkWarn && styles.warn]}>
              {row.walkWarn ? '! ' : '· '}
              {row.walk}
            </Text>
          ) : null}
          {row.unique ? (
            <Panel tone="teal" style={styles.unique}>
              <Text style={styles.uniqueText}>{row.unique}</Text>
            </Panel>
          ) : null}
        </Panel>
      ))}

      {ranking.dominated.length > 0 ? (
        <MenuRow
          title="Zdominowane — bliżej i lepiej da się mieć gdzie indziej"
          value={String(ranking.dominated.length)}
          chevron={showDominated ? '⌃' : '⌄'}
          onPress={() => setShowDominated((open) => !open)}
        />
      ) : null}
      {showDominated
        ? ranking.dominated.map((row) => (
            <Panel key={row.id} onPress={() => openRow(row, night)}>
              <View style={styles.head}>
                <Text style={[styles.name, styles.dim]}>{row.name}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.explain}>{row.explain}</Text>
              {row.dominated ? <Note>{row.dominated}</Note> : null}
            </Panel>
          ))
        : null}

      {ranking.noGo.length > 0 ? <Label>Odpada tej nocy</Label> : null}
      {ranking.noGo.map((row) => (
        <Panel key={row.id} tone="bad" dashed onPress={() => openRow(row, night)}>
          <View style={styles.head}>
            <Text style={styles.name}>{row.name}</Text>
            {row.selected ? <Chip label="w Nocy" tone="accent" /> : null}
            <Text style={styles.reject}>ODPUŚĆ</Text>
          </View>
          {row.reason ? <Text style={styles.reason}>{row.reason}</Text> : null}
        </Panel>
      ))}

      {ranking.missing.length > 0 ? (
        <>
          <Label tone="warn">{ranking.missingTitle}</Label>
          <Panel tone="warn">
            {ranking.missing.map((site) => (
              <View key={site.id} style={styles.listRow}>
                <Text style={styles.rowTitle}>{site.name}</Text>
                <Text style={styles.explain}>{site.distance}</Text>
              </View>
            ))}
            {ranking.missingAction ? (
              <Button
                label={ranking.fetching ? 'pobieram…' : (ranking.cooldown ?? ranking.missingAction)}
                tone="accent"
                disabled={ranking.fetching || ranking.cooldown !== null}
                onPress={ranking.fetchMissing}
              />
            ) : null}
            {ranking.fetchFailed ? (
              <Note>Nie udało się pobrać — sprawdź połączenie i spróbuj ponownie.</Note>
            ) : null}
            {ranking.activeMissing ? (
              <Note>Prognozę miejsca wybranego w Nocy pobiera zakładka Noc.</Note>
            ) : null}
          </Panel>
        </>
      ) : null}
    </>
  );
}

function Catalog() {
  const catalog = useSiteCatalog();
  const [name, setName] = useState('');
  const { fix } = catalog;

  return (
    <>
      <Note>{catalog.homeNote}</Note>
      {fix ? (
        <Panel tone="accent">
          <Text style={styles.coords}>{fix.coords}</Text>
          <Text style={[styles.walk, fix.weak && styles.warn]}>{fix.accuracy}</Text>
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Nazwa miejsca, np. „Błędowska, wjazd od Klucz”"
          />
          <Button
            label="Zapisz jako nowe miejsce"
            variant="primary"
            onPress={() => {
              catalog.saveNew(name);
              setName('');
            }}
          />
          {fix.nearby.length > 0 ? <Note>albo popraw współrzędne istniejącego:</Note> : null}
          {fix.nearby.map((site) => (
            <Pressable
              key={site.id}
              onPress={() => {
                catalog.overwrite(site.id);
                setName('');
              }}
              accessibilityRole="button"
              style={styles.listRow}
            >
              <Text style={styles.rowTitle}>{site.name}</Text>
              <Text style={styles.explain}>{site.distance}</Text>
            </Pressable>
          ))}
          <Button label="Anuluj" onPress={catalog.cancel} />
        </Panel>
      ) : (
        <>
          <Button
            label={catalog.locating ? 'Szukam pozycji…' : 'Jestem tutaj — zapisz ten punkt'}
            icon="locate-outline"
            tone="accent"
            disabled={catalog.locating}
            onPress={catalog.locate}
          />
          {catalog.locateError ? <Notice tone="bad">{catalog.locateError}</Notice> : null}
        </>
      )}
      {catalog.saved ? (
        <Notice tone="go" mark="✓">
          {catalog.saved}
        </Notice>
      ) : null}

      {catalog.rows.map((site) => (
        <Panel
          key={site.id}
          onPress={() => router.push({ pathname: '/site/[id]', params: { id: site.id } })}
        >
          <View style={styles.head}>
            <Text style={styles.name}>{site.name}</Text>
            <Chip label={`Bortle ${site.bortle}`} />
            <Text style={styles.chevron}>›</Text>
          </View>
          <Text style={styles.explain}>{site.travel}</Text>
          <Text style={[styles.walk, site.walkWarn && styles.warn]}>
            {site.walkWarn ? '! ' : '· '}
            {site.walk}
          </Text>
        </Panel>
      ))}

      <MenuRow title="Mapa zanieczyszczenia światłem" chevron="↗" onPress={catalog.openLightMap} />
      <Note>
        Współrzędne są orientacyjne — środki obszarów, nie zweryfikowane parkingi. Bortle i czas
        podejścia to szacunki. Notatki są po to, żeby je poprawiać po wyjazdach.
      </Note>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted },
  name: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary },
  dim: { color: colors.textSecondary },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  score: { fontFamily: fonts.monoMedium, fontSize: 24, color: colors.textPrimary },
  explain: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  walk: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
  warn: { color: colors.amber },
  unique: { paddingVertical: 8, paddingHorizontal: 10 },
  uniqueText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.teal },
  reject: { fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 1, color: colors.coral },
  reason: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowTitle: { flexShrink: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary },
  coords: { fontFamily: fonts.monoMedium, fontSize: 16, color: colors.textPrimary },
});
