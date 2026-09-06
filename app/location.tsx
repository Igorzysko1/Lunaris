import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LightPollutionLink } from '@/components/LightPollutionLink';
import { Badge, Pill } from '@/components/primitives';
import { CITIES, GMINY, type Coords, type Place } from '@/data/places';
import { bortleMeta, distanceKm, formatDistance } from '@/lib/astro';
import { useSettings, type ActiveLocation } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

type PickerTab = 'cities' | 'gminy';

const TABS: { key: PickerTab; label: string }[] = [
  { key: 'cities', label: 'Miasta' },
  { key: 'gminy', label: 'Gminy' },
];

/** Miejsce z policzoną odległością — liczymy ją raz, nie w komparatorze sortowania. */
type Ranked = { place: Place; distance: number };

export default function LocationScreen() {
  const router = useRouter();
  // Ten sam ekran wybiera miejsce obserwacji i punkt startowy (dom). Różnią się
  // tym, gdzie ląduje wynik i czy GPS ma sens: dom jest stały, więc go nie oferuje.
  const { target } = useLocalSearchParams<{ target?: string }>();
  const pickingHome = target === 'home';
  const { placeId, autoLocation, active, selectPlace, config, updateConfig, useGps } =
    useSettings();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<PickerTab>('cities');

  // Sortujemy od miejsca, w którym faktycznie jesteśmy (albo które wybrano ręcznie).
  const origin = active.coords;

  const places = useMemo<Ranked[]>(() => {
    const source = tab === 'gminy' ? GMINY : CITIES;
    const q = query.trim().toLowerCase();

    const matching = q
      ? source.filter(
          (p) => p.name.toLowerCase().includes(q) || p.region.toLowerCase().includes(q),
        )
      : source;

    return matching
      .map((place) => ({ place, distance: distanceKm(origin, place) }))
      .sort((a, b) => a.distance - b.distance);
  }, [tab, query, origin]);

  const selectedId = pickingHome ? config.observer.homePlaceId : placeId;

  const choosePlace = (id: string) => {
    if (pickingHome) updateConfig('observer', { homePlaceId: id });
    else selectPlace(id);
    router.back();
  };

  const chooseGps = () => {
    useGps();
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Wróć">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>
          {pickingHome ? 'Punkt startowy' : 'Wybierz lokalizację'}
        </Text>
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
        {TABS.map((t) => (
          <Pill
            key={t.key}
            label={t.label}
            active={tab === t.key}
            onPress={() => setTab(t.key)}
          />
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
              <Pressable onPress={chooseGps} style={styles.gpsRow}>
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
  selected,
  onPress,
}: {
  place: Place;
  distance: number;
  selected: boolean;
  onPress: () => void;
}) {
  const bortle = bortleMeta(place.bortle);

  return (
    <Pressable onPress={onPress} style={styles.placeRow}>
      <View style={styles.placeLeft}>
        <View style={styles.placeNameRow}>
          <Text
            style={[styles.placeName, selected && { color: colors.purple }]}
            numberOfLines={1}
          >
            {place.name}
          </Text>
          <Badge label={bortle.label} color={bortle.color} />
        </View>
        <Text style={styles.placeMeta}>
          <Text style={styles.placeDistance}>{formatDistance(distance)}</Text>
          <Text> · {place.region}</Text>
        </Text>
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
