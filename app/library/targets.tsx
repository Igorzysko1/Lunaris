import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEEP_SKY_OBJECTS, type DeepSkyObject } from '@/data/deep-sky';
import { foldForSearch } from '@/mock/constellation-figures';
import { colors, fonts } from '@/theme';
import { Chip, ChipRow, Field, Note, Panel, Screen, TitleBar } from '@/ui/kit';

type Kind = 'all' | DeepSkyObject['kind'];

const KINDS: [Kind, string][] = [
  ['all', 'wszystko'],
  ['galaktyka', 'galaktyki'],
  ['mgławica', 'mgławice'],
  ['gromada otwarta', 'gromady otwarte'],
  ['gromada kulista', 'gromady kuliste'],
];

const KIND_SHORT: Record<DeepSkyObject['kind'], string> = {
  galaktyka: 'galaktyka',
  mgławica: 'mgławica',
  'gromada otwarta': 'gr. otwarta',
  'gromada kulista': 'gr. kulista',
};

/**
 * W makiecie „w zasięgu" to sam próg jasności. Docelowo: `limitingMagnitude`,
 * `surfaceBrightness` i `minimumAngularSize` z `optics.ts` dla obu zestawów.
 */
const MOCK_REACH_MAGNITUDE = 9;

function sizeLabel(arcmin: number) {
  return arcmin >= 60
    ? `${(arcmin / 60).toFixed(1).replace('.', ',')}°`
    : `${arcmin.toFixed(1).replace('.', ',')}′`;
}

/** 12a: biblioteka celów — pełny katalog, filtr „tylko w zasięgu" jest wyborem, nie domyślnym. */
export default function TargetLibraryScreen() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [onlyReach, setOnlyReach] = useState(false);
  const folded = foldForSearch(query.trim());

  const shown = DEEP_SKY_OBJECTS.filter(
    (object) =>
      (kind === 'all' || object.kind === kind) &&
      (!onlyReach || object.magnitude <= MOCK_REACH_MAGNITUDE) &&
      (!folded ||
        foldForSearch(`${object.designation} ${object.name} ${object.kind}`).includes(folded)),
  );

  return (
    <Screen>
      <TitleBar
        back
        title="Biblioteka celów"
        subtitle={`${shown.length} z ${DEEP_SKY_OBJECTS.length}`}
      />
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder={`Szukaj w ${DEEP_SKY_OBJECTS.length} obiektach`}
        autoCorrect={false}
      />
      <ChipRow>
        {KINDS.map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            tone={kind === id ? 'accent' : 'neutral'}
            onPress={() => setKind(id)}
          />
        ))}
        <Chip
          label={onlyReach ? '● tylko w zasięgu' : '○ wszystkie'}
          tone={onlyReach ? 'accent' : 'neutral'}
          onPress={() => setOnlyReach((value) => !value)}
        />
      </ChipRow>
      <Note>
        Szukam po oznaczeniu, nazwie i typie. Kropka mówi o zasięgu sprzętu, nie o dzisiejszej nocy.
      </Note>
      {shown.length === 0 ? <Note>Nic nie pasuje do tych warunków.</Note> : null}

      {shown.map((object) => {
        const reach = object.magnitude <= MOCK_REACH_MAGNITUDE;

        return (
          <Panel
            key={object.id}
            onPress={() =>
              router.push({ pathname: '/library/target/[id]', params: { id: object.id } })
            }
            style={styles.row}
          >
            <View style={styles.designation}>
              <Text style={styles.code}>{object.designation}</Text>
              <Text style={[styles.reach, !reach && styles.outOfReach]}>{reach ? '●' : '○'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{object.name}</Text>
              <Text style={styles.meta}>
                {KIND_SHORT[object.kind]} · {object.magnitude.toFixed(1).replace('.', ',')} mag ·{' '}
                {sizeLabel(object.sizeArcmin)}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Panel>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  designation: { width: 64, gap: 2 },
  code: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.textPrimary },
  reach: { fontSize: 10, color: colors.purple },
  outOfReach: { color: colors.textMuted },
  name: { fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary },
  meta: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
});
