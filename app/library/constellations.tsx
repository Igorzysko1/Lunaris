import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useConstellationLibrary } from '@/hooks/use-library';
import { colors, fonts } from '@/theme';
import { ConstellationFigure } from '@/ui/figure';
import { Field, Label, Note, Screen, TitleBar } from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

/**
 * 8a: biblioteka gwiazdozbiorów (Więcej › Poza decyzją). Galeria dłuższa niż
 * ekran jest w porządku — to przegląd do nauki, nie widok decyzyjny.
 */
export default function ConstellationLibraryScreen() {
  const [query, setQuery] = useState('');
  const library = useConstellationLibrary(query);

  return (
    <Screen>
      <TitleBar
        back
        title="Biblioteka gwiazdozbiorów"
        subtitle={`${library.shown} z ${library.total}`}
      />
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Szukaj po nazwie, łacinie albo gwieździe"
        autoCorrect={false}
      />
      {library.groups.length === 0 ? <Note>{`Nic nie pasuje do „${query}".`}</Note> : null}

      {library.groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Label
            right={library.searching ? `${group.items.length} z ${group.total}` : `${group.total}`}
          >
            {group.label}
          </Label>
          <View style={styles.grid}>
            {group.items.map((c) => (
              <Pressable
                key={c.id}
                onPress={() =>
                  router.push({ pathname: '/constellation/[id]', params: { id: c.id } })
                }
                accessibilityRole="button"
                style={styles.card}
              >
                {c.figure ? (
                  <ConstellationFigure figure={c.figure} rotation={0} size={80} compact />
                ) : null}
                <Text style={styles.name} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.latin} numberOfLines={1}>
                  {c.latin}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Note>
        Nazwy, kotwice i podpowiedzi są z katalogu. Kształty są schematyczne — prawdziwe położenia
        gwiazd z katalogu jasnych gwiazd czekają na osobne zadanie.
      </Note>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  group: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '31.5%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  name: { fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary },
  latin: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
}));
