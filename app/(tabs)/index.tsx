import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { CloudCoverChart } from '@/components/CloudCoverChart';
import { EventCard } from '@/components/EventCard';
import {
  AstroTimesRow,
  MoonPhaseCard,
  NightRatingCard,
  NightSkeleton,
  NightTargetsCard,
} from '@/components/night-cards';
import { LightPollutionLink } from '@/components/LightPollutionLink';
import { SessionCard, SessionsSkeleton } from '@/components/session-cards';
import { Card, SectionLabel } from '@/components/primitives';
import { dayBucket, formatLongDate, formatTime } from '@/lib/date';
import { upcomingEvents } from '@/lib/events';
import { currentNightWindow } from '@/lib/night-window';
import { nightTargetsForProfiles } from '@/lib/sky-targets';
import { useSessions } from '@/lib/use-sessions';
import { useNightData } from '@/lib/use-night-data';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

export default function NightScreen() {
  const router = useRouter();
  const { active, config } = useSettings();
  const { status, data, refresh, refreshing } = useNightData(active.coords, active.bortle);
  const sessions = useSessions(active.coords, active.bortle, config);

  const { lat, lon } = active.coords;
  const nextEvent = useMemo(() => upcomingEvents(new Date(), { lat, lon })[0] ?? null, [lat, lon]);

  // Cele zależą od miejsca, jakości nieba i sprzętu — nie od prognozy, więc liczą
  // się lokalnie i nie czekają na Open-Meteo.
  const targets = useMemo(
    () =>
      nightTargetsForProfiles(
        currentNightWindow(new Date(), { lat, lon }),
        { lat, lon },
        config.opticsProfiles,
        active.bortle,
      ),
    [lat, lon, config.opticsProfiles, active.bortle],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>{formatLongDate()}</Text>
            <View style={styles.locationRow}>
              <Ionicons
                name={active.source === 'gps' ? 'navigate' : 'location'}
                size={14}
                color={colors.purple}
              />
              <Text style={styles.city}>{active.label}</Text>
            </View>
          </View>
          <RefreshButton spinning={refreshing} onPress={refresh} />
        </View>

        {status === 'loading' && <NightSkeleton />}

        {status === 'error' && (
          <Card style={styles.gap}>
            <View style={styles.chartError}>
              <Text style={styles.errorText}>Nie udało się pobrać prognozy na tę noc.</Text>
              <Pressable onPress={refresh}>
                <Text style={styles.retry}>Spróbuj ponownie</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {status === 'ready' && data && (
          <View>
            <View style={styles.gap}>
              <NightRatingCard
                data={data}
                dewWarningSpreadC={config.conditions.dewWarningSpreadC}
              />
            </View>

            <Card style={styles.gap}>
              <SectionLabel style={styles.chartLabel}>Zachmurzenie w nocy</SectionLabel>
              <CloudCoverChart forecast={data.forecast} />
            </Card>

            <View style={styles.gap}>
              <AstroTimesRow
                sunset={data.forecast.from}
                sunrise={data.forecast.to}
                moon={data.moon}
              />
            </View>

            <View style={styles.gap}>
              <MoonPhaseCard moon={data.moon} onPress={() => router.push('/moon')} />
            </View>

            <View style={styles.gap}>
              <NightTargetsCard targets={targets} />
            </View>

            <LightPollutionLink
              lat={active.coords.lat}
              lon={active.coords.lon}
              subtitle="Znajdź ciemniejsze miejsce w okolicy"
              style={styles.moonGap}
            />

            {nextEvent && (
              <>
                <SectionLabel style={styles.sessionsLabel}>Nadchodzące sesje</SectionLabel>
                {sessions.status === 'loading' && <SessionsSkeleton />}
                {sessions.status === 'error' && (
                  <Card style={styles.gap}>
                    <View style={styles.chartError}>
                      <Text style={styles.errorText}>
                        Nie udało się pobrać prognozy na kolejne noce.
                      </Text>
                      <Pressable onPress={sessions.refresh}>
                        <Text style={styles.retry}>Spróbuj ponownie</Text>
                      </Pressable>
                    </View>
                  </Card>
                )}
                {sessions.status === 'ready' &&
                  sessions.sessions.map((session) => (
                    <SessionCard
                      key={session.verdict.night.from.toISOString()}
                      session={session}
                      locationLabel={active.label}
                    />
                  ))}

                <SectionLabel style={styles.eventLabel}>Następny event</SectionLabel>
                <EventCard
                  event={nextEvent}
                  timeLabel={`${dayBucket(nextEvent.at)} · ${formatTime(nextEvent.at)}`}
                />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RefreshButton({ spinning, onPress }: { spinning: boolean; onPress: () => void }) {
  const [spin] = useState(() => new Animated.Value(0));

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
  sessionsLabel: {
    marginTop: 4,
    marginBottom: 8,
  },
});
