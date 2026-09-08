import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card, Divider, SectionLabel } from '@/components/primitives';
import { WEEKDAYS_SHORT, formatLongDate, formatMonth, isSameDay } from '@/lib/date';
import { moonMonth, type MoonDay } from '@/lib/moon';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, hexA, radius, touchSlop } from '@/theme';

export default function MoonCalendarScreen() {
  const router = useRouter();
  const { active } = useSettings();
  const today = useMemo(() => new Date(), []);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const { lat, lon } = active.coords;

  const days = useMemo(
    () => moonMonth(cursor.getFullYear(), cursor.getMonth(), lat, lon),
    [cursor, lat, lon],
  );

  const selectedDay = useMemo(
    () => days.find((d) => isSameDay(d.date, selected)) ?? days.find((d) => d.inMonth)!,
    [days, selected],
  );

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7)),
    [days],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          accessibilityLabel="Wróć"
          hitSlop={touchSlop(22)}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Kalendarz Księżyca</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthNav}>
          <Pressable
            accessibilityRole="button"
            onPress={() => shiftMonth(-1)}
            hitSlop={12}
            accessibilityLabel="Poprzedni miesiąc"
          >
            <Ionicons name="chevron-back" size={20} color={colors.purple} />
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonth(cursor)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => shiftMonth(1)}
            hitSlop={12}
            accessibilityLabel="Następny miesiąc"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.purple} />
          </Pressable>
        </View>

        <View style={styles.weekdays}>
          {WEEKDAYS_SHORT.map((day) => (
            <Text key={day} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>

        {weeks.map((week, i) => (
          <View key={`week-${i}`} style={styles.week}>
            {week.map((day) => (
              <DayCell
                key={day.date.toISOString()}
                day={day}
                isToday={isSameDay(day.date, today)}
                isSelected={isSameDay(day.date, selectedDay.date)}
                onPress={() => setSelected(day.date)}
              />
            ))}
          </View>
        ))}

        <View style={styles.legend}>
          <LegendItem color={colors.textSecondary} label="Nów" />
          <LegendItem color={colors.amber} label="Pełnia" />
        </View>

        <DayDetail day={selectedDay} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DayCell({
  day,
  isToday,
  isSelected,
  onPress,
}: {
  day: MoonDay;
  isToday: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  // Nów i pełnia to jedyne dni, które muszą rzucać się w oczy z odległości ręki.
  const eventColor =
    day.event === 'full' ? colors.amber : day.event === 'new' ? colors.textSecondary : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.cell,
        isSelected && styles.cellSelected,
        eventColor && !isSelected && { backgroundColor: hexA(eventColor, 0.12) },
      ]}
    >
      <Text
        style={[
          styles.cellDay,
          !day.inMonth && styles.cellDayOutside,
          isToday && styles.cellDayToday,
        ]}
      >
        {day.date.getDate()}
      </Text>
      <Text style={[styles.cellGlyph, !day.inMonth && styles.cellGlyphOutside]}>{day.glyph}</Text>
      {eventColor && <View style={[styles.eventDot, { backgroundColor: eventColor }]} />}
    </Pressable>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.eventDot, styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function DayDetail({ day }: { day: MoonDay }) {
  const hhmm = (date: Date | null) =>
    date
      ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      : '—';

  const rising = day.illuminationTo >= day.illuminationFrom;

  return (
    <Card style={styles.detail}>
      <Text style={styles.detailDate}>{formatLongDate(day.date)}</Text>

      <View style={styles.detailPhase}>
        <Text style={styles.detailGlyph}>{day.glyph}</Text>
        <View style={styles.detailPhaseText}>
          <Text style={styles.detailName}>{day.name}</Text>
          {day.event && (
            <Text style={styles.detailEvent}>
              {day.event === 'full' ? 'Pełnia tego dnia' : 'Nów tego dnia'}
            </Text>
          )}
        </View>
      </View>

      <Divider style={styles.detailDivider} />

      <SectionLabel style={styles.detailLabel}>Oświetlenie tarczy</SectionLabel>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeValue}>{day.illuminationFrom}%</Text>
        <Ionicons
          name={rising ? 'arrow-forward' : 'arrow-forward'}
          size={14}
          color={colors.textMuted}
        />
        <Text style={styles.rangeValue}>{day.illuminationTo}%</Text>
        <Text style={styles.rangeHint}>{rising ? 'przybywa' : 'ubywa'}</Text>
      </View>

      <RangeBar min={day.illuminationMin} max={day.illuminationMax} />

      <Divider style={styles.detailDivider} />

      <View style={styles.timesRow}>
        <View>
          <Text style={styles.timeLabel}>Wschód Księżyca</Text>
          <Text style={styles.timeValue}>{hhmm(day.rise)}</Text>
        </View>
        <View style={styles.alignRight}>
          <Text style={styles.timeLabel}>Zachód Księżyca</Text>
          <Text style={styles.timeValue}>{hhmm(day.set)}</Text>
        </View>
      </View>
    </Card>
  );
}

/** Pasek 0–100% z zaznaczonym przedziałem, w którym Księżyc świeci tego dnia. */
function RangeBar({ min, max }: { min: number; max: number }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { left: `${min}%`, width: `${Math.max(max - min, 1)}%` }]} />
    </View>
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  monthLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    color: colors.textPrimary,
  },
  weekdays: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  week: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 0.86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: radius.md,
    borderWidth: HAIRLINE,
    borderColor: 'transparent',
  },
  cellSelected: {
    backgroundColor: hexA(colors.purple, 0.2),
    borderColor: colors.purple,
  },
  cellDay: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textPrimary,
  },
  cellDayOutside: {
    color: colors.textMuted,
  },
  cellDayToday: {
    color: colors.purple,
    fontFamily: fonts.monoSemiBold,
  },
  cellGlyph: {
    fontSize: 13,
    lineHeight: 16,
  },
  cellGlyphOutside: {
    opacity: 0.35,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  detail: {
    marginTop: 4,
  },
  detailDate: {
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    color: colors.textPrimary,
  },
  detailPhase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  detailGlyph: {
    fontSize: 34,
    lineHeight: 40,
  },
  detailPhaseText: {
    flex: 1,
  },
  detailName: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  detailEvent: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.amber,
    marginTop: 3,
  },
  detailDivider: {
    marginVertical: 14,
  },
  detailLabel: {
    marginBottom: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeValue: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 22,
    color: colors.textPrimary,
  },
  rangeHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 2,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.grid,
    marginTop: 12,
  },
  barFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 3,
    backgroundColor: colors.amber,
  },
  timesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  timeLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
  },
  timeValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
