import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Divider, SectionLabel } from '@/components/primitives';
import { ASTRO_TIMES, MOON_PHASE, type NightData } from '@/data/night';
import { ratingMeta } from '@/lib/astro';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

export function NightRatingCard({ data }: { data: NightData }) {
  const meta = ratingMeta(data.rating);
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
          <Text style={styles.cloudsValue}>{data.clouds}%</Text>
          <Text style={styles.metricLabel}>chmury</Text>
        </View>
      </View>

      <Divider style={styles.ratingDivider} />

      <View style={styles.metricsRow}>
        <Metric label="Wilgotność" value={`${data.humidity}%`} />
        <Metric label="Widoczność" value={`${data.visibility} km`} />
        <Metric label="Opady" value={`${data.precipitation} mm`} />
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const ASTRO_ROW = [
  { icon: 'arrow-down-outline', label: 'Zach. Słońca', value: ASTRO_TIMES.sunset },
  { icon: 'moon-outline', label: 'Wsch. Ks.', value: ASTRO_TIMES.moonrise },
  { icon: 'moon-outline', label: 'Zach. Ks.', value: ASTRO_TIMES.moonset },
  { icon: 'arrow-up-outline', label: 'Wsch. Słońca', value: ASTRO_TIMES.sunrise },
] as const;

export function AstroTimesRow() {
  return (
    <View style={styles.astroRow}>
      {ASTRO_ROW.map((item, i) => (
        <View
          key={item.label}
          style={[styles.astroCell, i < ASTRO_ROW.length - 1 && styles.astroCellBorder]}
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

export function MoonPhaseCard() {
  return (
    <Card style={styles.moonCard}>
      <View style={styles.moonLeft}>
        <Text style={styles.moonGlyph}>{MOON_PHASE.glyph}</Text>
        <View>
          <Text style={styles.moonName}>{MOON_PHASE.name}</Text>
          <Text style={styles.moonDetail}>{MOON_PHASE.detail}</Text>
        </View>
      </View>
      <View style={styles.alignRight}>
        <Text style={styles.moonIllumination}>{MOON_PHASE.illumination}%</Text>
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
