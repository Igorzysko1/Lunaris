import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CATALOG,
  DOMINATED,
  GO_SITES,
  GPS_FIX,
  MISSING,
  PARTIAL_SITES,
  REJECTED,
} from '@/mock/where';
import { useForecast } from '@/store/forecast';
import { colors, fonts } from '@/theme';
import {
  Button,
  Chip,
  ChipRow,
  Field,
  Label,
  MenuRow,
  Note,
  Panel,
  Screen,
  Segments,
  TitleBar,
  todo,
} from '@/ui/kit';

type Segment = 'ranking' | 'catalog';

const SEGMENTS: readonly (readonly [Segment, string])[] = [
  ['ranking', 'Ranking'],
  ['catalog', 'Katalog'],
];

function openSite(id: string) {
  router.push({ pathname: '/site/[id]', params: { id } });
}

/** Gdzie — „skąd patrzeć?": ranking i katalog to ta sama lista w dwóch porządkach. */
export default function WhereScreen() {
  const [segment, setSegment] = useState<Segment>('ranking');
  const { bundle } = useForecast();

  return (
    <Screen>
      <TitleBar
        title="Gdzie"
        right="noc: dziś ▾"
        onRightPress={() => todo('Wybór nocy dla rankingu')}
      />
      <Segments items={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'catalog' ? <Catalog /> : bundle === null ? <PartialRanking /> : <Ranking />}
    </Screen>
  );
}

function Ranking() {
  const [showDominated, setShowDominated] = useState(false);

  return (
    <>
      <Note>Dojazd z: Jaworzno · kolejność: ocena nieba minus kara za drogę</Note>
      {GO_SITES.map((site, i) => (
        <Panel key={site.id} onPress={() => openSite(site.id)}>
          <View style={styles.head}>
            <Text style={styles.rank}>{i + 1}</Text>
            <Text style={styles.name}>{site.name}</Text>
            <Chip label={`Bortle ${site.bortle}`} />
            <Text style={styles.chevron}>›</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{site.score}</Text>
            <Text style={styles.explain}>{site.explain}</Text>
          </View>
          <ChipRow>
            <Chip label={site.verdict} tone="go" />
            <Chip label={site.window} />
            <Chip label={site.travel} />
          </ChipRow>
          <Text style={[styles.walk, site.walkWarn && styles.warn]}>
            {site.walkWarn ? '! ' : '· '}
            {site.walk}
          </Text>
          {site.unique ? (
            <Panel tone="teal" style={styles.unique}>
              <Text style={styles.uniqueText}>{site.unique}</Text>
            </Panel>
          ) : null}
        </Panel>
      ))}

      <MenuRow
        title="Zdominowane — bliżej i lepiej da się mieć gdzie indziej"
        value={String(DOMINATED.length)}
        chevron={showDominated ? '⌃' : '⌄'}
        onPress={() => setShowDominated((open) => !open)}
      />
      {showDominated
        ? DOMINATED.map((site) => (
            <Panel key={site.id} onPress={() => openSite(site.id)}>
              <View style={styles.head}>
                <Text style={[styles.name, styles.dim]}>{site.name}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.explain}>{site.explain}</Text>
              <Note>{site.why}</Note>
            </Panel>
          ))
        : null}

      <Label>Odpada tej nocy</Label>
      {REJECTED.map((site) => (
        <Panel key={site.id} tone="bad" dashed onPress={() => openSite(site.id)}>
          <View style={styles.head}>
            <Text style={styles.name}>{site.name}</Text>
            <Text style={styles.reject}>ODPUŚĆ</Text>
          </View>
          <Text style={styles.reason}>{site.reason}</Text>
        </Panel>
      ))}
    </>
  );
}

/** 13c: brak prognozy dotyczy pojedynczych miejsc, więc ranking wymienia brakujące wprost. */
function PartialRanking() {
  return (
    <>
      <Note>Policzone 3 z 5 miejsc · dojazd z: Jaworzno</Note>
      {PARTIAL_SITES.map((site, i) => (
        <Panel key={site.id} onPress={() => openSite(site.id)}>
          <View style={styles.head}>
            <Text style={styles.rank}>{i + 1}</Text>
            <Text style={styles.name}>{site.name}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          <Text style={styles.explain}>
            {site.score} · {site.explain}
          </Text>
        </Panel>
      ))}
      <Label tone="warn">{`Bez prognozy · ${MISSING.length} miejsca`}</Label>
      <Panel tone="warn">
        {MISSING.map((site) => (
          <View key={site.id} style={styles.listRow}>
            <Text style={styles.rowTitle}>{site.name}</Text>
            <Text style={styles.explain}>{site.distance}</Text>
          </View>
        ))}
        <Button
          label="Pobierz prognozę dla tych dwóch"
          tone="accent"
          onPress={() => todo('Pobranie prognozy dla brakujących miejsc')}
        />
      </Panel>
    </>
  );
}

function Catalog() {
  const [fixOpen, setFixOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <>
      {fixOpen ? (
        <Panel tone="accent">
          <Text style={styles.coords}>{GPS_FIX.coords}</Text>
          <Text style={[styles.walk, styles.warn]}>{GPS_FIX.accuracy}</Text>
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Nazwa miejsca, np. „Błędowska, wjazd od Klucz”"
          />
          <Button
            label="Zapisz jako nowe miejsce"
            variant="primary"
            onPress={() => todo('Zapis nowej miejscówki z fixa GPS')}
          />
          <Note>albo popraw współrzędne istniejącego:</Note>
          {GPS_FIX.nearby.map((site) => (
            <Pressable
              key={site.id}
              onPress={() => todo(`Korekta współrzędnych: ${site.name}`)}
              accessibilityRole="button"
              style={styles.listRow}
            >
              <Text style={styles.rowTitle}>{site.name}</Text>
              <Text style={styles.explain}>{site.distance}</Text>
            </Pressable>
          ))}
          <Button label="Anuluj" onPress={() => setFixOpen(false)} />
        </Panel>
      ) : (
        <Button
          label="Jestem tutaj — zapisz ten punkt"
          icon="locate-outline"
          tone="accent"
          onPress={() => setFixOpen(true)}
        />
      )}

      {CATALOG.map((site) => (
        <Panel key={site.id} onPress={() => openSite(site.id)}>
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

      <MenuRow
        title="Mapa zanieczyszczenia światłem"
        chevron="↗"
        onPress={() => todo('Link do mapy zanieczyszczenia światłem')}
      />
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
