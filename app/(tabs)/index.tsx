import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { CloudCoverChart } from '@/components/CloudCoverChart';
import { EventCard } from '@/components/EventCard';
import {
  AstroTimesRow,
  MoonPhaseCard,
  NightRatingCard,
  NightSkeleton,
} from '@/components/night-cards';
import { Card, SectionLabel } from '@/components/primitives';
import { EVENTS } from '@/data/events';
import { TODAY_LABEL } from '@/data/night';
import { useNightData } from '@/lib/use-night-data';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

export default function NightScreen() {
  const { location } = useSettings();
  const { status, data, refresh, refreshing } = useNightData();
  const nextEvent = EVENTS[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>{TODAY_LABEL}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.purple} />
              <Text style={styles.city}>{location}</Text>
            </View>
          </View>
          <RefreshButton spinning={refreshing} onPress={refresh} />
        </View>

        {status === 'loading' ? (
          <NightSkeleton />
        ) : (
          <View>
            <View style={styles.gap}>
              <NightRatingCard data={data} />
            </View>

            <Card style={styles.gap}>
              <SectionLabel style={styles.chartLabel}>Zachmurzenie w nocy</SectionLabel>
              {status === 'error' ? (
                <View style={styles.chartError}>
                  <Text style={styles.errorText}>Nie udało się pobrać prognozy zachmurzenia.</Text>
                  <Pressable onPress={refresh}>
                    <Text style={styles.retry}>Spróbuj ponownie</Text>
                  </Pressable>
                </View>
              ) : (
                <CloudCoverChart bars={data.bars} />
              )}
            </Card>

            <View style={styles.gap}>
              <AstroTimesRow />
            </View>

            <View style={styles.moonGap}>
              <MoonPhaseCard />
            </View>

            <SectionLabel style={styles.eventLabel}>Następny event</SectionLabel>
            <EventCard event={nextEvent} timeLabel={`Dziś · ${nextEvent.date}`} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RefreshButton({ spinning, onPress }: { spinning: boolean; onPress: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!spinning) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinning, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable onPress={onPress} style={styles.refreshButton} accessibilityLabel="Odśwież prognozę">
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name="refresh-outline" size={19} color={colors.purple} />
      </Animated.View>
    </Pressable>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  city: {
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    color: colors.textPrimary,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    marginBottom: 16,
  },
  moonGap: {
    marginBottom: 20,
  },
  chartLabel: {
    marginBottom: 12,
  },
  chartError: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.coral,
    textAlign: 'center',
  },
  retry: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.purple,
    textDecorationLine: 'underline',
  },
  eventLabel: {
    marginBottom: 8,
  },
});
