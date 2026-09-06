import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/EventCard';
import { Pill } from '@/components/primitives';
import { EVENT_FILTERS, type AstroEvent, type EventCategory } from '@/data/events';
import { dayBucket } from '@/lib/date';
import { upcomingEvents } from '@/lib/events';
import { useSettings } from '@/store/settings';
import { colors, fonts } from '@/theme';

type Filter = EventCategory | 'all';

export default function EventsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const { active } = useSettings();
  const { lat, lon } = active.coords;

  // Eventy zależą od miejsca (widoczność radiantu, wschód Księżyca), więc
  // przeliczamy je po zmianie lokalizacji, a nie raz na starcie aplikacji.
  const events = useMemo(() => upcomingEvents(new Date(), { lat, lon }), [lat, lon]);

  const sections = useMemo(() => {
    const now = new Date();
    const matching = events.filter((e) => filter === 'all' || e.cat === filter);

    // Nagłówki wynikają z dat — kolejność bierze się z sortowania w upcomingEvents().
    const grouped: { title: string; events: AstroEvent[] }[] = [];
    for (const event of matching) {
      const title = dayBucket(event.at, now);
      const last = grouped[grouped.length - 1];
      if (last?.title === title) last.events.push(event);
      else grouped.push({ title, events: [event] });
    }
    return grouped;
  }, [events, filter]);

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
