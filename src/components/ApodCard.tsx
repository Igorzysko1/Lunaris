/**
 * Zdjęcie dnia NASA na ekranie Noc.
 *
 * Stoi na samym dole i tak ma zostać. Ekran odpowiada na pytanie „czy jechać",
 * a to jest jedyna karta, która na nie nie odpowiada — postawiona wyżej,
 * odsuwałaby werdykt poniżej krawędzi ekranu.
 *
 * Opisu NASA nie tłumaczymy i nie udajemy, że jest po polsku. Tłumaczenie
 * maszynowe w aplikacji, która nigdzie indziej nie używa modelu językowego,
 * byłoby jedynym miejscem, gdzie tekst na ekranie nie pochodzi od źródła —
 * a przy okazji zaciemniałoby cytat, który ma być cytatem.
 */

import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, SectionLabel } from '@/components/primitives';
import type { Apod } from '@/lib/apod';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

export function ApodCard({ apod }: { apod: Apod }) {
  const [expanded, setExpanded] = useState(false);

  // Dla wideo `url` prowadzi do osadzenia YouTube'a, nie do obrazu — podgląd
  // przychodzi wtedy osobnym polem.
  const image = apod.mediaType === 'image' ? apod.url : apod.thumbnailUrl;

  return (
    <Card>
      <SectionLabel style={styles.label}>Zdjęcie dnia NASA</SectionLabel>

      {image && (
        <Image
          source={{ uri: image }}
          style={styles.image}
          resizeMode="cover"
          // Opis od NASA bywa akapitem — na etykietę bierzemy sam tytuł,
          // bo czytnik ekranu ma powiedzieć, co to za obraz, a nie streścić go.
          accessibilityLabel={apod.title}
          accessible
        />
      )}

      <Text style={styles.title}>{apod.title}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{apod.date}</Text>
        {apod.mediaType === 'video' && <Text style={styles.meta}>· materiał wideo</Text>}
      </View>

      {/* Gdy zdjęcie nie jest w domenie publicznej, podpis autora jest warunkiem
          użycia, a nie uprzejmością. Bywa przy tym, że w polu przychodzi nie
          nazwisko, lecz całe zdanie — pokazujemy je i tak, bo lepiej podpisać
          za dużo niż za mało, ale bez rozlewania karty na pół ekranu. */}
      {apod.copyright && (
        <Text style={styles.copyright} numberOfLines={2}>
          © {apod.copyright}
        </Text>
      )}

      {apod.explanation.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Zwiń opis NASA' : 'Rozwiń opis NASA (po angielsku)'}
          onPress={() => setExpanded((value) => !value)}
        >
          <Text style={styles.explanation} numberOfLines={expanded ? undefined : 2}>
            {apod.explanation}
          </Text>
          <Text style={styles.more}>{expanded ? 'zwiń' : 'więcej (po angielsku)'}</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Otwórz materiał NASA w przeglądarce"
        onPress={() => Linking.openURL(apod.url)}
        style={styles.openRow}
      >
        <Text style={styles.open}>Otwórz w przeglądarce</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 10,
  },
  image: {
    width: '100%',
    // Proporcja zamiast sztywnej wysokości: kadry APOD bywają i panoramiczne,
    // i pionowe, a karta ma zostać tej samej wysokości niezależnie od tego.
    aspectRatio: 3 / 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
    marginTop: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  copyright: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  explanation: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 10,
  },
  more: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.purple,
    marginTop: 4,
  },
  openRow: {
    marginTop: 12,
  },
  open: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.purple,
  },
});
