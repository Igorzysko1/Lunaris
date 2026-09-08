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
  SeeingCard,
} from '@/components/night-cards';
import { LightPollutionLink } from '@/components/LightPollutionLink';
import { SessionCard, SessionsSkeleton } from '@/components/session-cards';
import { Card, SectionLabel } from '@/components/primitives';
import { dayBucket, formatLongDate, formatTime } from '@/lib/date';
import { upcomingEvents } from '@/lib/events';
import { formatAge } from '@/lib/forecast-cache';
import { horizonOf } from '@/lib/horizon';
import { currentNightWindow } from '@/lib/night-window';
import { nightTargetsForProfiles } from '@/lib/sky-targets';
import { useSessions } from '@/hooks/use-sessions';
import { useNightData } from '@/hooks/use-night-data';
import { useForecast } from '@/store/forecast';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius, touchSlop } from '@/theme';

export default function NightScreen() {
  const router = useRouter();
  const { active, config } = useSettings();
  const { status, data, savedAt, stale, failure, refresh, refreshing } = useNightData(
    active.coords,
    active.bortle,
  );
  const sessions = useSessions(active.coords, active.bortle, config, active.walkMinutes);
  const { cycle } = useForecast();

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
        horizonOf(active.horizonMask, active.horizonOverrides),
      ),
    [lat, lon, config.opticsProfiles, active.bortle, active.horizonMask, active.horizonOverrides],
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
            {/* Dwie różne wiarygodności: policzone dla tego punktu z mapy
                jasności, albo odziedziczone po najbliższej miejscowości. */}
            <Text style={styles.sky}>
              Bortle {active.bortle} ·{' '}
              {active.bortleSource === 'map'
                ? 'policzone dla tego punktu'
                : 'z najbliższej miejscowości'}
            </Text>
          </View>
          <RefreshButton spinning={refreshing} onPress={refresh} />
        </View>

        {status === 'loading' && <NightSkeleton />}

        {status === 'error' && (
          <Card style={styles.gap}>
            <View style={styles.chartError}>
              {/* Trzy różne stany, nie dwa. Brak `failure` znaczy, że żadne
                  żądanie nie doszło do skutku — obwinianie o to serwisu
                  pogodowego wysyłało szukających w złą stronę. */}
              <Text style={styles.errorText}>
                {failure === 'offline'
                  ? 'Brak połączenia, a nie mam zapisanej prognozy dla tego miejsca.'
                  : failure === 'rate-limit'
                    ? 'Za dużo zapytań do serwisu pogodowego — spróbuję ponownie za pół godziny.'
                    : failure === 'api'
                      ? 'Serwis pogodowy nie odpowiedział poprawnie.'
                      : 'Nie mam jeszcze prognozy dla tego miejsca.'}
              </Text>
              {/* Prawdziwy powód, a nie jego streszczenie: bez niego nie da się
                  odróżnić awarii sieci od błędu w samej aplikacji. */}
              {cycle.lastError && <Text style={styles.errorDetail}>{cycle.lastError}</Text>}
              <Pressable accessibilityRole="button" onPress={refresh}>
                <Text style={styles.retry}>Spróbuj ponownie</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Zapis jest normalnym źródłem odczytu, więc sam w sobie nie jest
            ostrzeżeniem. Ostrzegamy dopiero wtedy, gdy odświeżenie zawiodło albo
            gdy dane przetrwały termin, w którym miały się zmienić. */}
        {status === 'ready' && savedAt && (failure || stale) && (
          <Pressable
            accessibilityRole="button"
            onPress={refresh}
            style={[styles.staleBar, styles.gap]}
          >
            <Ionicons
              name={failure === 'offline' ? 'cloud-offline-outline' : 'warning-outline'}
              size={15}
              color={colors.amber}
            />
            <Text style={styles.staleText}>
              {failure === 'offline'
                ? 'Brak sieci'
                : failure === 'rate-limit'
                  ? 'Limit zapytań'
                  : failure
                    ? 'Serwis nie odpowiada'
                    : 'Dane nie odświeżyły się o porze'}{' '}
              — {formatAge(savedAt)}
            </Text>
            <Text style={styles.staleRetry}>Odśwież</Text>
          </Pressable>
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

            {data.seeing && (
              <View style={styles.gap}>
                <SeeingCard seeing={data.seeing} />
              </View>
            )}

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
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/review')}
                  style={[styles.reviewLink, styles.gap]}
                >
                  <Ionicons name="map-outline" size={18} color={colors.purple} />
                  <View style={styles.reviewText}>
                    <Text style={styles.reviewTitle}>Gdzie dziś jechać</Text>
                    <Text style={styles.reviewHint}>
                      Porównaj {config.sites.length} miejscówek na najbliższe noce
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/journal')}
                  style={[styles.reviewLink, styles.gap]}
                >
                  <Ionicons name="create-outline" size={18} color={colors.purple} />
                  <View style={styles.reviewText}>
                    <Text style={styles.reviewTitle}>Zapisz noc w dzienniku</Text>
                    <Text style={styles.reviewHint}>
                      Co udało się zobaczyć, a co nie — z listy celów tej nocy
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>

                <SectionLabel style={styles.sessionsLabel}>
                  {sessions.savedAt
                    ? `Nadchodzące sesje · z prognozy ${formatAge(sessions.savedAt)}`
                    : 'Nadchodzące sesje'}
                </SectionLabel>
                {sessions.status === 'loading' && <SessionsSkeleton />}
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.refreshButton}
      accessibilityLabel="Odśwież prognozę"
      hitSlop={touchSlop(38)}
    >
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
  sky: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
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
    // Minimum, nie sztywna wysokość. Mieszczą się tu trzy różne komunikaty
    // o błędzie plus przycisk ponowienia — a to jedyny stan ekranu, w którym
    // przycięty tekst zostawia użytkownika bez wyjścia.
    minHeight: 120,
    paddingVertical: 16,
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
  errorDetail: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retry: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.purple,
    textDecorationLine: 'underline',
  },
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
  },
  reviewText: {
    flex: 1,
  },
  reviewTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  reviewHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  staleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: HAIRLINE,
    borderColor: colors.amber,
  },
  staleText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  staleRetry: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.purple,
  },
  eventLabel: {
    marginBottom: 8,
  },
  sessionsLabel: {
    marginTop: 4,
    marginBottom: 8,
  },
});
