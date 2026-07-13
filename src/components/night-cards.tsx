import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Divider, SectionLabel } from '@/components/primitives';
import { dewRiskColor, ratingMeta } from '@/lib/astro';
import type { Moon } from '@/lib/moon';
import type { NightData } from '@/lib/use-night-data';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

export function NightRatingCard({ data }: { data: NightData }) {
  const meta = ratingMeta(data.rating);
  const { forecast } = data;
  const enter = useRef(new Animated.Value(0)).current;

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
          color={dewRiskColor(forecast.minDewSpread)}
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

export function MoonPhaseCard({ moon }: { moon: Moon }) {
  return (
    <Card style={styles.moonCard}>
      <View style={styles.moonLeft}>
        <Text style={styles.moonGlyph}>{moon.glyph}</Text>
        <View>
          <Text style={styles.moonName}>{moon.name}</Text>
          <Text style={styles.moonDetail}>{moon.detail}</Text>
        </View>
      </View>
      <View style={styles.alignRight}>
        <Text style={styles.moonIllumination}>{moon.illumination}%</Text>
        <Text style={styles.metricLabel}>oświetlenia</Text>
      </View>
    </Card>
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
  moonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
