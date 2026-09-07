import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Divider, SectionLabel } from '@/components/primitives';
import { dewRiskColor, ratingMeta } from '@/lib/astro';
import { formatTime } from '@/lib/date';
import type { Moon } from '@/lib/moon';
import { describeSeeing, type Seeing } from '@/lib/seeing';
import { describeOutOfReach, rankedTargets, type SkyTarget } from '@/lib/sky-targets';
import type { NightData } from '@/lib/use-night-data';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

export function NightRatingCard({
  data,
  dewWarningSpreadC,
}: {
  data: NightData;
  /** Próg ostrzeżenia o rosie z konfiguracji — patrz src/lib/config.ts. */
  dewWarningSpreadC: number;
}) {
  const meta = ratingMeta(data.rating);
  const { forecast } = data;
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [data.rating, enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Card>
      <View style={styles.ratingTop}>
        <View>
          <SectionLabel>Ocena nocy</SectionLabel>
          <Animated.Text
            style={[
              styles.ratingNumber,
              { color: meta.color, opacity: enter, transform: [{ translateY }] },
            ]}
          >
            {data.rating}
          </Animated.Text>
          <Text style={styles.ratingLabel}>{meta.label}</Text>
        </View>
        <View style={styles.alignRight}>
          <Text style={styles.cloudsValue}>{Math.round(forecast.avgCloud)}%</Text>
          <Text style={styles.metricLabel}>chmury</Text>
        </View>
      </View>

      <Divider style={styles.ratingDivider} />

      <View style={styles.metricsRow}>
        <Metric label="Wilgotność" value={`${Math.round(forecast.avgHumidity)}%`} />
        <Metric
          label="Rosa"
          value={`${forecast.minDewSpread.toFixed(1)}°`}
          color={dewRiskColor(forecast.minDewSpread, dewWarningSpreadC)}
        />
        <Metric label="Opady" value={`${forecast.totalPrecipitation.toFixed(1)} mm`} />
      </View>
    </Card>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

/** Księżyc nie każdej doby wschodzi i zachodzi — wtedy nie ma czego pokazać. */
function hhmm(date: Date | null): string {
  if (!date) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Słońce z efemeryd Open-Meteo, Księżyc liczony przez suncalc. */
export function AstroTimesRow({
  sunset,
  sunrise,
  moon,
}: {
  sunset: Date;
  sunrise: Date;
  moon: Moon;
}) {
  const cells = [
    { icon: 'arrow-down-outline', label: 'Zach. Słońca', value: hhmm(sunset) },
    { icon: 'moon-outline', label: 'Wsch. Ks.', value: hhmm(moon.rise) },
    { icon: 'moon-outline', label: 'Zach. Ks.', value: hhmm(moon.set) },
    { icon: 'arrow-up-outline', label: 'Wsch. Słońca', value: hhmm(sunrise) },
  ] as const;

  return (
    <View style={styles.astroRow}>
      {cells.map((item, i) => (
        <View
          key={item.label}
          style={[styles.astroCell, i < cells.length - 1 && styles.astroCellBorder]}
        >
          <View style={styles.astroLabelRow}>
            <Ionicons name={item.icon} size={13} color={colors.textMuted} />
            <Text style={styles.astroLabel}>{item.label}</Text>
          </View>
          <Text style={styles.astroValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Cele na tę noc. Lista wynika ze sprzętu z konfiguracji i jakości nieba, więc po
 * zmianie apertury albo wyjeździe w ciemniejsze miejsce zmienia się sama.
 */
/**
 * Spokój atmosfery — osobno od oceny nocy, bo odpowiada na inne pytanie.
 *
 * Ocena nocy mówi, czy warto jechać; seeing mówi, na ile warto podkręcić
 * powiększenie po przyjeździe. Dlatego jest kartą informacyjną, a nie składnikiem
 * werdyktu: przy lornetce nie zmienia niczego, przy teleskopie decyduje o tym,
 * co oglądać, a nie o tym, czy wyjeżdżać.
 */
export function SeeingCard({ seeing }: { seeing: Seeing }) {
  const dots = [1, 2, 3, 4, 5];

  return (
    <Card>
      <View style={styles.seeingHeader}>
        <SectionLabel style={styles.seeingLabel}>Spokój atmosfery</SectionLabel>
        <View style={styles.seeingDots}>
          {dots.map((n) => (
            <View key={n} style={[styles.seeingDot, n <= seeing.index && styles.seeingDotOn]} />
          ))}
        </View>
      </View>
      <Text style={styles.seeingValue}>{seeing.label}</Text>
      <Text style={styles.seeingDetail}>{describeSeeing(seeing)}</Text>
    </Card>
  );
}

/** Ile celów pokazujemy na karcie. Reszta zostaje policzona, ale niewypisana. */
const SHOWN_TARGETS = 10;

export function NightTargetsCard({ targets }: { targets: SkyTarget[] }) {
  const visible = targets.filter((t) => t.visible);
  const inReach = rankedTargets(targets, SHOWN_TARGETS);
  const rest = visible.length - inReach.length;

  // Obiekty odrzucone przez teren wymieniamy z nazwy, bo to informacja o
  // miejscu, a nie o niebie — reszta odpada z powodów, których przejściem
  // w bok się nie naprawi, więc wystarczy ich policzyć.
  const blocked = targets.filter((t) => t.outOfReach === 'behind-horizon');

  // Przy jednym zestawie nie ma czego odróżniać — podpis sprzętu tylko
  // zaśmiecałby listę.
  const profiles = new Set(targets.map((t) => t.profileId));
  const showProfile = profiles.size > 1;

  return (
    <Card>
      <SectionLabel style={styles.targetsLabel}>Cele na tę noc</SectionLabel>

      {inReach.length === 0 ? (
        <Text style={styles.targetsEmpty}>
          Żaden z celów nie wznosi się tej nocy dość wysoko dla tego sprzętu.
        </Text>
      ) : (
        inReach.map((target, i) => (
          <View
            key={`${target.profileId}-${target.id}`}
            style={[styles.targetRow, i > 0 && styles.targetRowGap]}
          >
            <View style={styles.targetText}>
              <Text style={styles.targetName} numberOfLines={1}>
                {target.name}
              </Text>
              <Text style={styles.targetDetail}>
                {showProfile ? `${target.profileLabel} · ${target.detail}` : target.detail}
              </Text>
            </View>
            <View style={styles.alignRight}>
              <Text style={styles.targetAltitude}>{Math.round(target.maxAltitude)}°</Text>
              <Text style={styles.targetTime}>góruje {formatTime(target.transitAt)}</Text>
            </View>
          </View>
        ))
      )}

      {rest > 0 && (
        <Text style={styles.targetsMore}>
          …i {rest} {rest === 1 ? 'dalszy cel' : 'dalszych celów'} w zasięgu sprzętu.
        </Text>
      )}

      {blocked.length > 0 && (
        <>
          <Divider style={styles.targetsDivider} />
          {/* Powód odrzucenia niesie informację: „za terenem na SW" znaczy
              co innego niż „za nisko" — pierwsze zmienia się po przejściu
              dwustu metrów, drugie nie. */}
          {blocked.map((target) => (
            <View key={`${target.profileId}-${target.id}`} style={styles.blockedRow}>
              <Text style={styles.blockedName} numberOfLines={1}>
                {target.name}
              </Text>
              <Text style={styles.blockedWhy} numberOfLines={1}>
                {describeOutOfReach(target)}
              </Text>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

export function MoonPhaseCard({ moon, onPress }: { moon: Moon; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.moonCard}>
        <View style={styles.moonLeft}>
          <Text style={styles.moonGlyph}>{moon.glyph}</Text>
          <View style={styles.moonText}>
            <Text style={styles.moonName}>{moon.name}</Text>
            <Text style={styles.moonDetail}>{moon.detail}</Text>
          </View>
        </View>
        <View style={styles.moonRight}>
          <View style={styles.alignRight}>
            <Text style={styles.moonIllumination}>{moon.illumination}%</Text>
            <Text style={styles.metricLabel}>oświetlenia</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Card>
    </Pressable>
  );
}

export function NightSkeleton() {
  return (
    <View>
      <Card style={styles.gap}>
        <View style={[styles.bone, { height: 11, width: 80, marginBottom: 14 }]} />
        <View style={[styles.bone, { height: 48, width: 110, marginBottom: 16 }]} />
        <Divider style={{ marginBottom: 14 }} />
        <View style={styles.skeletonMetrics}>
          <View style={[styles.bone, { height: 14, width: 60 }]} />
          <View style={[styles.bone, { height: 14, width: 60 }]} />
          <View style={[styles.bone, { height: 14, width: 60 }]} />
        </View>
      </Card>
      <View style={[styles.blockSkeleton, styles.gap, { height: 150 }]} />
      <View
        style={[
          styles.blockSkeleton,
          styles.gap,
          { height: 62, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
        ]}
      />
      <View style={[styles.blockSkeleton, { height: 64 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ratingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ratingNumber: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 48,
    lineHeight: 48,
    marginTop: 6,
  },
  ratingLabel: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingDivider: {
    marginVertical: 14,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  cloudsValue: {
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
  },
  metricValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textPrimary,
  },
  astroRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  astroCell: {
    flex: 1,
    alignItems: 'center',
  },
  astroCellBorder: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  astroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  astroLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  astroValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  targetsLabel: {
    marginBottom: 12,
  },
  targetsEmpty: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  targetRowGap: {
    marginTop: 12,
  },
  targetText: {
    flex: 1,
  },
  targetName: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  targetDetail: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  targetAltitude: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    color: colors.teal,
  },
  targetTime: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 3,
  },
  blockedName: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  blockedWhy: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.amber,
  },
  seeingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeingLabel: {
    marginBottom: 0,
  },
  seeingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  seeingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  seeingDotOn: {
    backgroundColor: colors.teal,
  },
  seeingValue: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: 8,
  },
  seeingDetail: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 4,
  },
  targetsMore: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 10,
  },
  targetsDivider: {
    marginTop: 14,
    marginBottom: 10,
  },
  moonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moonLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  moonText: {
    flex: 1,
  },
  moonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moonGlyph: {
    fontSize: 34,
    lineHeight: 40,
  },
  moonName: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  moonDetail: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  moonIllumination: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 22,
    color: colors.amber,
  },
  gap: {
    marginBottom: 16,
  },
  bone: {
    backgroundColor: colors.skeleton,
    borderRadius: radius.sm,
  },
  skeletonMetrics: {
    flexDirection: 'row',
    gap: 24,
  },
  blockSkeleton: {
    backgroundColor: colors.surface,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
});
