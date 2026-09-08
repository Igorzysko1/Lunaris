import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LightPollutionLink } from '@/components/LightPollutionLink';
import { Badge, Pill } from '@/components/primitives';
import { siteAsPlace, type ObservingSite } from '@/data/observing-sites';
import { CITIES, GMINY, type Place } from '@/data/places';
import { bortleMeta, distanceKm, formatDistance } from '@/lib/astro';
import { useSettings, type ActiveLocation } from '@/store/settings';
import { HAIRLINE, colors, fonts, touchSlop } from '@/theme';

type PickerTab = 'sites' | 'cities' | 'gminy';

const TABS: { key: PickerTab; label: string }[] = [
  { key: 'sites', label: 'Miejscówki' },
  { key: 'cities', label: 'Miasta' },
  { key: 'gminy', label: 'Gminy' },
];

/**
 * Miejsce z policzoną odległością — liczymy ją raz, nie w komparatorze sortowania.
 * `site` jest ustawione tylko dla wpisów z katalogu miejscówek: niosą dodatkowo
 * dojście od parkingu i notatki z wyjazdów, których zwykła miejscowość nie ma.
 */
type Ranked = { place: Place; distance: number; site?: ObservingSite };

export default function LocationScreen() {
  const router = useRouter();
  // Ten sam ekran wybiera miejsce obserwacji i punkt startowy (dom). Różnią się
  // tym, gdzie ląduje wynik i czy GPS ma sens: dom jest stały, więc go nie oferuje.
  const { target } = useLocalSearchParams<{ target?: string }>();
  const pickingHome = target === 'home';
  const { placeId, autoLocation, active, selectPlace, config, updateConfig, enableGps } =
    useSettings();
  const [query, setQuery] = useState('');
  // Punktem startowym jest dom, a nie miejscówka — przy jego wyborze katalog
  // nie ma sensu, więc zakładka znika i domyślnie stoimy na miastach.
  const [tab, setTab] = useState<PickerTab>(target === 'home' ? 'cities' : 'sites');
  const tabs = target === 'home' ? TABS.filter((t) => t.key !== 'sites') : TABS;

  // Sortujemy od miejsca, w którym faktycznie jesteśmy (albo które wybrano ręcznie).
  const origin = active.coords;

  const sites = config.sites;

  const places = useMemo<Ranked[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (p: { name: string; region: string }) =>
      !q || p.name.toLowerCase().includes(q) || p.region.toLowerCase().includes(q);

    if (tab === 'sites') {
      return sites
        .filter(matches)
        .map((site) => ({
          site,
          place: siteAsPlace(site),
          distance: distanceKm(origin, site),
        }))
        .sort((a, b) => a.distance - b.distance);
    }

    return (tab === 'gminy' ? GMINY : CITIES)
      .filter(matches)
      .map((place) => ({ place, distance: distanceKm(origin, place) }))
      .sort((a, b) => a.distance - b.distance);
  }, [tab, query, origin, sites]);

  const selectedId = pickingHome ? config.observer.homePlaceId : placeId;

  const choosePlace = (id: string) => {
    if (pickingHome) updateConfig('observer', { homePlaceId: id });
    else selectPlace(id);
    router.back();
  };

  const chooseGps = () => {
    enableGps();
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          accessibilityLabel="Wróć"
          hitSlop={touchSlop(22)}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{pickingHome ? 'Punkt startowy' : 'Wybierz lokalizację'}</Text>
      </View>

      <View style={styles.searchWrapper}>
        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj miejscowości..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pill key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </View>

      <FlatList
        data={places}
        keyExtractor={(item) => item.place.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={10}
        ListHeaderComponent={
          <>
            <LightPollutionLink
              lat={origin.lat}
              lon={origin.lon}
              subtitle="Zobacz, gdzie naprawdę jest ciemno"
              style={styles.mapLink}
            />

            {!pickingHome && (
              <Pressable accessibilityRole="button" onPress={chooseGps} style={styles.gpsRow}>
                <View style={styles.gpsLeft}>
                  <Ionicons name="navigate" size={18} color={colors.purple} />
                  <View>
                    <Text style={styles.placeName}>Moja lokalizacja</Text>
                    <Text style={styles.gpsDetail}>{gpsDetail(autoLocation, active)}</Text>
                  </View>
                </View>
                {autoLocation && active.source === 'gps' && (
                  <Ionicons name="checkmark" size={18} color={colors.purple} />
                )}
              </Pressable>
            )}
          </>
        }
        renderItem={({ item }) => (
          <PlaceRow
            place={item.place}
            distance={item.distance}
            site={item.site}
            selected={(pickingHome || !autoLocation) && selectedId === item.place.id}
            onPress={() => choosePlace(item.place.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Brak wyników dla „{query}”</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

/** Wiersz GPS mówi prawdę o tym, co się stało — a nie udaje, że wszystko gra. */
function gpsDetail(autoLocation: boolean, active: ActiveLocation): string {
  if (!autoLocation) return 'Wykryj miejsce, w którym jesteś';

  switch (active.gpsStatus) {
    case 'loading':
      return 'Ustalam pozycję…';
    case 'denied':
      return 'Brak zgody na lokalizację — włącz ją w ustawieniach systemu';
    case 'unavailable':
      return 'Nie udało się ustalić pozycji';
    case 'granted':
      return `GPS · ${active.label} · sortowanie od najbliższych`;
    default:
      return 'GPS';
  }
}

function PlaceRow({
  place,
  distance,
  site,
  selected,
  onPress,
}: {
  place: Place;
  distance: number;
  /** Ustawione tylko dla miejscówek z katalogu. */
  site?: ObservingSite;
  selected: boolean;
  onPress: () => void;
}) {
  const bortle = bortleMeta(place.bortle);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.placeRow}>
      <View style={styles.placeLeft}>
        <View style={styles.placeNameRow}>
          <Text style={[styles.placeName, selected && { color: colors.purple }]} numberOfLines={1}>
            {place.name}
          </Text>
          <Badge label={bortle.label} color={bortle.color} />
        </View>
        <Text style={styles.placeMeta}>
          <Text style={styles.placeDistance}>{formatDistance(distance)}</Text>
          <Text> · {place.region}</Text>
          {site !== undefined && site.walkMinutes > 0 && (
            <Text> · {Math.round(site.walkMinutes)} min od parkingu</Text>
          )}
        </Text>
        {site !== undefined && site.notes.length > 0 && (
          <Text style={styles.placeNote} numberOfLines={2}>
            {site.notes}
          </Text>
        )}
      </View>
      {selected && <Ionicons name="checkmark" size={18} color={colors.purple} />}
    </Pressable>
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
    gap: 12,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 22,
    color: colors.textPrimary,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: HAIRLINE,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  mapLink: {
    marginBottom: 12,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gpsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gpsDetail: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grid,
  },
  placeLeft: {
    flex: 1,
  },
  placeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeName: {
    flexShrink: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  placeMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },
  placeNote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  placeDistance: {
    color: colors.textSecondary,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
  },
});
