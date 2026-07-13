import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/EventCard';
import { Pill } from '@/components/primitives';
import {
  BUCKET_ORDER,
  EVENTS,
  EVENT_FILTERS,
  type EventCategory,
} from '@/data/events';
import { colors, fonts } from '@/theme';

type Filter = EventCategory | 'all';

export default function EventsScreen() {
  const [filter, setFilter] = useState<Filter>('all');

  const sections = useMemo(() => {
    const matching = EVENTS.filter((e) => filter === 'all' || e.cat === filter);
    return BUCKET_ORDER.map((bucket) => ({
      title: bucket,
      events: matching.filter((e) => e.bucket === bucket),
    })).filter((section) => section.events.length > 0);
  }, [filter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nadchodzące eventy</Text>

        <View style={styles.filters}>
          {EVENT_FILTERS.map((f) => (
            <Pill
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </View>

        {sections.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Brak eventów w tym okresie</Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.title}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.events.map((event) => (
                <View key={event.id} style={styles.eventGap}>
                  <EventCard event={event} clampDescription />
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textMuted,
    paddingTop: 12,
    paddingBottom: 6,
  },
  eventGap: {
    marginBottom: 8,
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
  },
});
