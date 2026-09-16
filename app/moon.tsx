import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  WEEKDAYS_SHORT,
  formatLongDate,
  formatMonth,
  formatTimeOrDash,
  isSameDay,
} from '@/lib/date';
import { moonMonth, type MoonDay } from '@/lib/moon';
import { useSettings } from '@/store/settings';
import { colors, fonts, hexA } from '@/theme';
import { Label, Note, Panel, Screen, Stat, TitleBar } from '@/ui/kit';
import { pct } from '@/ui/night';
import { themedStyles } from '@/ui/theme';

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Kalendarz Księżyca: faza każdego dnia miesiąca i szczegół wybranego dnia.
 * Wejście z Nocy › Warunki otwiera go na dniu wybranej nocy, a wschody
 * i zachody liczą się dla aktywnego miejsca.
 */
export default function MoonCalendarScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { active } = useSettings();
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState(() => {
    const requested = date ? new Date(date) : null;
    return requested && !Number.isNaN(requested.getTime()) ? requested : today;
  });
  const [cursor, setCursor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  const { lat, lon } = active.coords;
  const days = useMemo(
    () => moonMonth(cursor.getFullYear(), cursor.getMonth(), lat, lon),
    [cursor, lat, lon],
  );

  const selectedDay = days.find((d) => isSameDay(d.date, selected)) ?? days.find((d) => d.inMonth)!;
  const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <Screen>
      <TitleBar back title="Kalendarz Księżyca" subtitle={`wschody i zachody · ${active.label}`} />

      <Panel>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Poprzedni miesiąc"
            style={styles.arrow}
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.month}>{formatMonth(cursor)}</Text>
          <Pressable
            onPress={() => shiftMonth(1)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Następny miesiąc"
            style={styles.arrow}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.week}>
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
                today={isSameDay(day.date, today)}
                selected={isSameDay(day.date, selectedDay.date)}
                onPress={() => setSelected(day.date)}
              />
            ))}
          </View>
        ))}

        <View style={styles.legend}>
          <Legend color={colors.textSecondary} label="nów" />
          <Legend color={colors.amber} label="pełnia" />
        </View>
      </Panel>

      <DayDetail day={selectedDay} />
    </Screen>
  );
}

function DayCell({
  day,
  today,
  selected,
  onPress,
}: {
  day: MoonDay;
  today: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  // Nów i pełnia to jedyne dni, które muszą rzucać się w oczy z odległości ręki.
  const event =
    day.event === 'full' ? colors.amber : day.event === 'new' ? colors.textSecondary : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${formatLongDate(day.date)}, ${day.name}`}
      accessibilityState={{ selected }}
      style={[
        styles.cell,
        selected && styles.cellSelected,
        event && !selected && { backgroundColor: hexA(event, 0.12) },
      ]}
    >
      <Text style={[styles.day, !day.inMonth && styles.outside, today && styles.today]}>
        {day.date.getDate()}
      </Text>
      <Text style={[styles.glyph, !day.inMonth && styles.faded]}>{day.glyph}</Text>
      {event ? <View style={[styles.dot, { backgroundColor: event }]} /> : null}
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function DayDetail({ day }: { day: MoonDay }) {
  const rising = day.illuminationTo >= day.illuminationFrom;

  return (
    <>
      <Label right={day.event === 'full' ? 'pełnia' : day.event === 'new' ? 'nów' : undefined}>
        {lowerFirst(formatLongDate(day.date))}
      </Label>
      <Panel>
        <View style={styles.phase}>
          <Text style={styles.phaseGlyph}>{day.glyph}</Text>
          <View style={styles.flex}>
            <Text style={styles.phaseName}>{day.name}</Text>
            <Text style={styles.phaseDetail}>
              {day.illuminationFrom}% → {day.illuminationTo}% · {rising ? 'przybywa' : 'ubywa'}
            </Text>
          </View>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                left: pct(day.illuminationMin / 100),
                width: pct(Math.max(day.illuminationMax - day.illuminationMin, 1) / 100),
              },
            ]}
          />
        </View>
        <View style={styles.week}>
          <Stat label="wschód" value={formatTimeOrDash(day.rise)} style={styles.flex} />
          <Stat label="zachód" value={formatTimeOrDash(day.set)} style={styles.flex} />
        </View>
      </Panel>
      <Note>
        Pasek to zakres oświetlenia tarczy w ciągu doby. Kreska zamiast godziny znaczy, że tego dnia
        Księżyc nie wschodzi albo nie zachodzi.
      </Note>
    </>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontFamily: fonts.mono, fontSize: 20, color: colors.purple },
  month: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  week: { flexDirection: 'row', gap: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  cell: {
    flex: 1,
    aspectRatio: 0.86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellSelected: { backgroundColor: hexA(colors.purple, 0.2), borderColor: colors.purple },
  day: { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
  outside: { color: colors.textMuted },
  today: { fontFamily: fonts.monoSemiBold, color: colors.purple },
  glyph: { fontSize: 13, lineHeight: 16 },
  faded: { opacity: 0.35 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textMuted },
  phase: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  phaseGlyph: { fontSize: 34, lineHeight: 40 },
  phaseName: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  phaseDetail: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.fill,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: colors.amber },
}));
