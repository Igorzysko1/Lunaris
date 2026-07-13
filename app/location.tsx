import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Pill } from '@/components/primitives';
import { CITIES, DEVICE_CITY, GMINY, type Place } from '@/data/places';
import { bortleMeta, distanceFromDevice, formatDistance } from '@/lib/astro';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

type PickerTab = 'cities' | 'gminy';

const TABS: { key: PickerTab; label: string }[] = [
  { key: 'cities', label: 'Miasta' },
  { key: 'gminy', label: 'Gminy' },
];

export default function LocationScreen() {
  const router = useRouter();
  const { location, autoLocation, selectPlace, useGps } = useSettings();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<PickerTab>('cities');

  const places = useMemo(() => {
    const source = tab === 'gminy' ? GMINY : CITIES;
    const q = query.trim().toLowerCase();
    return source
      .filter(
        (p) => p.name.toLowerCase().includes(q) || p.region.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          distanceFromDevice(a.lat, a.lon) - distanceFromDevice(b.lat, b.lon),
      );
  }, [tab, query]);

  const choosePlace = (name: string) => {
    selectPlace(name);
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
        <Text style={styles.title}>Wybierz lokalizację</Text>
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

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Pressable onPress={chooseGps} style={styles.gpsRow}>
          <View style={styles.gpsLeft}>
            <Ionicons name="navigate" size={18} color={colors.purple} />
            <View>
              <Text style={styles.placeName}>Moja lokalizacja</Text>
              <Text style={styles.gpsDetail}>
                GPS · {DEVICE_CITY} · sortowanie od najbliższych
              </Text>
            </View>
          </View>
          {autoLocation && <Ionicons name="checkmark" size={18} color={colors.purple} />}
        </Pressable>

        {places.map((place) => (
          <PlaceRow
            key={`${place.name}-${place.region}`}
            place={place}
            selected={!autoLocation && location === place.name}
            onPress={() => choosePlace(place.name)}
          />
        ))}

        {places.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Brak wyników dla „{query}”</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlaceRow({
  place,
  selected,
  onPress,
}: {
  place: Place;
  selected: boolean;
  onPress: () => void;
}) {
  const bortle = bortleMeta(place.bortle);
  const distance = formatDistance(distanceFromDevice(place.lat, place.lon));

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
          <Text style={styles.placeDistance}>{distance}</Text>
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
