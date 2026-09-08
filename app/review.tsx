import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Card, Pill, SectionLabel } from '@/components/primitives';
import { describeRejection, nightLabel } from '@/lib/session-text';
import { bortleMeta, formatDistance } from '@/lib/astro';
import { formatAge } from '@/lib/forecast-cache';
import { explainScore, type SiteOutlook } from '@/lib/site-review';
import { useSiteReview } from '@/hooks/use-site-review';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius, touchSlop } from '@/theme';

/**
 * Przegląd miejscówek: gdzie tej nocy warto pojechać.
 *
 * Układ miejsce × noc, bo tak wygląda decyzja — najpierw wybiera się noc,
 * potem porównuje miejsca. Kolejność ustala ocena nieba pomniejszona o karę
 * za dojazd, więc obok każdej pozycji stoi wyliczenie, a nie samo miejsce
 * na liście: bliższa miejscówka z gorszym niebem potrafi wygrać z dalszą.
 */
export default function ReviewScreen() {
  const router = useRouter();
  const { config, placeId, selectPlace } = useSettings();
  const { status, reviews, savedAt, refresh } = useSiteReview(config);
  const [nightIndex, setNightIndex] = useState(0);
  const [showDominated, setShowDominated] = useState(false);

  const review = reviews[nightIndex];

  const choose = (siteId: string) => {
    selectPlace(siteId);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          accessibilityLabel="Wróć"
          hitSlop={touchSlop(30)}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Gdzie dziś jechać</Text>
        <Pressable
          accessibilityRole="button"
          onPress={refresh}
          accessibilityLabel="Odśwież przegląd"
          hitSlop={touchSlop(30)}
          style={styles.back}
        >
          <Ionicons name="refresh-outline" size={19} color={colors.purple} />
        </Pressable>
      </View>

      {reviews.length > 1 && (
        <View style={styles.tabs}>
          {reviews.map((r, i) => (
            <Pill
              key={r.night.from.toISOString()}
              label={nightLabel(r.night.from, new Date())}
              active={i === nightIndex}
              onPress={() => setNightIndex(i)}
            />
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {status === 'loading' && <Text style={styles.muted}>Liczę przegląd miejscówek…</Text>}

        {status === 'error' && (
          <Card>
            <Text style={styles.errorText}>
              Nie mam prognozy dla żadnej miejscówki i nie ma zapisu, z którego dałoby się ją
              odtworzyć.
            </Text>
            <Pressable accessibilityRole="button" onPress={refresh}>
              <Text style={styles.retry}>Spróbuj ponownie</Text>
            </Pressable>
          </Card>
        )}

        {savedAt && (
          <Text style={styles.stale}>Dane {formatAge(savedAt)} — brak świeżej prognozy.</Text>
        )}

        {status === 'ready' && review && (
          <>
            {review.go.length === 0 && review.noGo.length > 0 && (
              <Text style={styles.muted}>Tej nocy żadna miejscówka nie przechodzi progów.</Text>
            )}

            {review.go.length > 1 && (
              <Text style={styles.muted}>
                {review.go.length} miejsca warte rozważenia — wybierz, dokąd liczyć pogodę.
              </Text>
            )}

            {review.go.map((outlook) => (
              <OutlookRow
                key={outlook.site.id}
                outlook={outlook}
                selected={placeId === outlook.site.id}
                onChoose={() => choose(outlook.site.id)}
              />
            ))}

            {/* Złożone, a nie ukryte: jedyny przypadek, w którym ranking
                decyduje za użytkownika, więc musi dać się rozwinąć. */}
            {review.dominated.length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowDominated((v) => !v)}
                style={styles.foldRow}
              >
                <Ionicons
                  name={showDominated ? 'chevron-down' : 'chevron-forward'}
                  size={15}
                  color={colors.textMuted}
                />
                <Text style={styles.foldText}>
                  {review.dominated.length} {review.dominated.length === 1 ? 'miejsce' : 'miejsca'}{' '}
                  dalej i słabiej
                </Text>
              </Pressable>
            )}
            {showDominated &&
              review.dominated.map((outlook) => (
                <OutlookRow
                  key={outlook.site.id}
                  outlook={outlook}
                  selected={placeId === outlook.site.id}
                  onChoose={() => choose(outlook.site.id)}
                />
              ))}

            {review.noGo.length > 0 && (
              <SectionLabel style={styles.groupLabel}>Odpada</SectionLabel>
            )}
            {review.noGo.map((outlook) => (
              <OutlookRow
                key={outlook.site.id}
                outlook={outlook}
                selected={placeId === outlook.site.id}
                onChoose={() => choose(outlook.site.id)}
              />
            ))}

            {review.missing.length > 0 && (
              <>
                <SectionLabel style={styles.groupLabel}>Bez prognozy</SectionLabel>
                <Card variant="raised">
                  <Text style={styles.muted}>{review.missing.map((s) => s.name).join(', ')}</Text>
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OutlookRow({
  outlook,
  selected,
  onChoose,
}: {
  outlook: SiteOutlook;
  selected: boolean;
  onChoose: () => void;
}) {
  const { config } = useSettings();
  const bortle = bortleMeta(outlook.bortle);
  const rejected = outlook.verdict.rejection;
  const window = outlook.verdict.window;

  return (
    <Pressable accessibilityRole="button" onPress={onChoose}>
      <Card variant="raised" style={[styles.card, selected && styles.cardSelected]}>
        <View style={styles.cardTop}>
          <Text style={styles.name} numberOfLines={1}>
            {outlook.site.name}
          </Text>
          {selected && <Ionicons name="checkmark" size={16} color={colors.purple} />}
          <Badge label={bortle.label} color={bortle.color} />
        </View>

        <Text style={styles.meta}>
          {formatDistance(outlook.distanceKm)} · {Math.round(outlook.travelMinutes)} min drogi
        </Text>

        {/* Wyliczenie, a nie sama pozycja: inaczej nie widać, dlaczego bliższa
          miejscówka z gorszym niebem stoi wyżej niż dalsza i ciemniejsza. */}
        <Text style={styles.score}>{explainScore(outlook, config)}</Text>

        {/* Powód, dla którego gorsze i dalsze miejsce jednak tu jest. */}
        {outlook.uniqueTargets.length > 0 && (
          <Text style={styles.unique}>
            Tylko stąd widać: {outlook.uniqueTargets.slice(0, 3).join(', ')}
            {outlook.uniqueTargets.length > 3
              ? ` i ${outlook.uniqueTargets.length - 3} więcej`
              : ''}
          </Text>
        )}

        {outlook.dominatedBy && (
          <Text style={styles.dominated}>Bliżej i lepiej: {outlook.dominatedBy}</Text>
        )}

        {rejected ? (
          <Text style={styles.rejection}>{describeRejection(rejected)}</Text>
        ) : (
          window && (
            <Text style={styles.window}>
              Okno {Math.round(window.durationMinutes / 60)} h
              {outlook.verdict.warnings.length > 0
                ? ` · ${outlook.verdict.warnings.length} ostrzeżenie`
                : ''}
            </Text>
          )
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: { padding: 4 },
  title: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    color: colors.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  groupLabel: { marginTop: 16, marginBottom: 8 },
  card: { marginBottom: 10 },
  cardSelected: { borderColor: colors.purple },
  foldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  foldText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  unique: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.teal,
    marginTop: 6,
  },
  dominated: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  name: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary },
  meta: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  score: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  window: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.teal,
    marginTop: 6,
  },
  rejection: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.coral,
    marginTop: 6,
  },
  muted: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  stale: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.amber,
    marginBottom: 10,
    padding: 8,
    borderRadius: radius.md,
    borderWidth: HAIRLINE,
    borderColor: colors.amber,
  },
  errorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.coral, marginBottom: 8 },
  retry: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.purple,
    textDecorationLine: 'underline',
  },
});
