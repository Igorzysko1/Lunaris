import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTargetLibrary, type LibraryKind } from '@/hooks/use-library';
import { colors, fonts } from '@/theme';
import { Chip, ChipRow, Field, Note, Panel, Screen, TitleBar } from '@/ui/kit';

const KINDS: [LibraryKind, string][] = [
  ['all', 'wszystko'],
  ['galaktyka', 'galaktyki'],
  ['mgławica', 'mgławice'],
  ['gromada otwarta', 'gromady otwarte'],
  ['gromada kulista', 'gromady kuliste'],
];

/** 12a: biblioteka celów — pełny katalog, filtr „tylko w zasięgu" jest wyborem, nie domyślnym. */
export default function TargetLibraryScreen() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<LibraryKind>('all');
  const [onlyReach, setOnlyReach] = useState(false);
  const library = useTargetLibrary(query, kind, onlyReach);

  return (
    <Screen>
      <TitleBar
        back
        title="Biblioteka celów"
        subtitle={`${library.rows.length} z ${library.total}`}
      />
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder={`Szukaj w ${library.total} obiektach`}
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
      <Note>{library.note}</Note>
      {library.rows.length === 0 ? <Note>Nic nie pasuje do tych warunków.</Note> : null}

      {library.rows.map((object) => (
        <Panel
          key={object.id}
          onPress={() =>
            router.push({ pathname: '/library/target/[id]', params: { id: object.id } })
          }
          style={styles.row}
        >
          <View style={styles.designation}>
            <Text style={styles.code}>{object.designation}</Text>
            <Text style={[styles.reach, !object.reach && styles.outOfReach]}>
              {object.reach ? '●' : '○'}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name}>{object.name}</Text>
            <Text style={styles.meta}>{object.meta}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Panel>
      ))}
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
