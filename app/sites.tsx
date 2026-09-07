import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Card, SectionLabel } from '@/components/primitives';
import { type ObservingSite } from '@/data/observing-sites';
import { bortleMeta, distanceKm, formatDistance } from '@/lib/astro';
import { findPlaceById, type Coords } from '@/data/places';
import { useSettings } from '@/store/settings';
import { colors, fonts } from '@/theme';

/**
 * Katalog miejscówek: dokąd realnie się jeździ i co o tych miejscach wiadomo.
 *
 * Czas dojazdu jest **liczony**, a nie zapisany — z odległości i średniej prędkości
 * z profilu obserwatora. Zapisany osobno rozjechałby się przy pierwszej korekcie
 * prędkości i pokazywałby co innego niż plan wyjazdu w werdykcie nocy.
 */
export default function SitesScreen() {
  const router = useRouter();
  const { config, updateSiteNotes } = useSettings();

  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;
  const home: Coords | null = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Wróć" style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Miejscówki</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionLabel style={styles.groupLabel}>
          {home ? `Dojazd z: ${homePlace?.name}` : 'Ustaw punkt startowy, żeby zobaczyć dojazd'}
        </SectionLabel>

        {config.sites.map((site) => (
          <SiteCard
            key={site.id}
            site={site}
            home={home}
            speedKmh={config.observer.averageSpeedKmh}
            walkToleranceMin={config.observer.walkToleranceMin}
            onNotes={(notes) => updateSiteNotes(site.id, notes)}
          />
        ))}

        <Text style={styles.note}>
          Współrzędne są orientacyjne — środki obszarów, nie zweryfikowane parkingi. Bortle i czas
          podejścia to szacunki. Notatki są po to, żeby je poprawiać po wyjazdach.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SiteCard({
  site,
  home,
  speedKmh,
  walkToleranceMin,
  onNotes,
}: {
  site: ObservingSite;
  home: Coords | null;
  speedKmh: number;
  walkToleranceMin: number;
  onNotes: (notes: string) => void;
}) {
  // Notatka trzymana lokalnie w trakcie pisania; do konfiguracji trafia po
  // wyjściu z pola, żeby każdy znak nie wywoływał zapisu na dysk.
  const [draft, setDraft] = useState(site.notes);

  const bortle = bortleMeta(site.bortle);
  const km = home ? distanceKm(home, site) : null;
  const driveMin = km === null ? null : Math.round((km / speedKmh) * 60);
  const walkTooLong = site.walkMinutes > walkToleranceMin;

  return (
    <Card variant="raised" style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.name} numberOfLines={1}>
          {site.name}
        </Text>
        <Badge label={bortle.label} color={bortle.color} />
      </View>

      <Text style={styles.meta}>
        {km === null ? site.region : `${formatDistance(km)} · ok. ${driveMin} min jazdy`}
      </Text>

      <View style={styles.walkRow}>
        <Ionicons
          name="walk-outline"
          size={14}
          color={walkTooLong ? colors.amber : colors.textMuted}
        />
        <Text style={[styles.walk, walkTooLong && { color: colors.amber }]}>
          {site.walkMinutes === 0
            ? 'stanowisko przy samochodzie'
            : `${Math.round(site.walkMinutes)} min od parkingu`}
          {walkTooLong && ` — powyżej tolerancji ${walkToleranceMin} min`}
        </Text>
      </View>

      <TextInput
        style={styles.notes}
        value={draft}
        onChangeText={setDraft}
        onBlur={() => onNotes(draft.trim())}
        placeholder="Notatki z wyjazdu: gdzie zaparkować, jaki teren, co przeszkadza"
        placeholderTextColor={colors.textMuted}
        multiline
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: {
    padding: 4,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  groupLabel: {
    marginBottom: 8,
  },
  card: {
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
  },
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  walk: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  notes: {
    marginTop: 10,
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  note: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
});
