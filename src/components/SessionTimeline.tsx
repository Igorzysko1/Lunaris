import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TimeStepper } from '@/components/calendar-cards';
import { formatTime } from '@/lib/date';
import {
  STEP_LABELS,
  TIMELINE_STEPS,
  lastStep,
  needsCalendarSync,
  nextStep,
  segmentMinutes,
  type TimelineStep,
} from '@/lib/session-timeline';
import { formatDuration } from '@/lib/session-text';
import { useSessionTimeline } from '@/hooks/use-session-timeline';
import { useGoogle } from '@/store/google';
import { HAIRLINE, colors, fonts, hexA, radius } from '@/theme';

/** Krok poprawki godziny. Pięć minut — tyle zwykle dzieli dotknięcie od faktu. */
const ADJUST_MINUTES = 5;

const STEP_ICONS: Record<TimelineStep, ComponentProps<typeof Ionicons>['name']> = {
  departed: 'car-outline',
  arrived: 'location-outline',
  packing: 'archive-outline',
  home: 'home-outline',
};

/**
 * Przebieg trwającej nocy — jeden duży przycisk na raz.
 *
 * Używany po ciemku, zmęczonym wzrokiem i często w rękawicach, więc bez
 * wpisywania i bez wyboru: przycisk zawsze proponuje kolejny krok. Pomyłki
 * poprawia się pod spodem — cofnięciem albo przesunięciem godziny o pięć minut.
 */
export function SessionTimeline({
  night,
  plan,
  window,
  bookingId,
}: {
  night: { from: Date; to: Date };
  plan: { departAt: Date; returnAt: Date } | null;
  window: { from: Date; to: Date } | null;
  bookingId: string;
}) {
  const google = useGoogle();
  const run = useSessionTimeline({ night, plan, window, bookingId });

  if (!run.loaded) return <ActivityIndicator size="small" color={colors.textMuted} />;

  const { timeline } = run;
  const next = nextStep(timeline);
  const last = lastStep(timeline);
  const recorded = TIMELINE_STEPS.filter((step) => timeline?.[step]);
  const segments = timeline ? segmentMinutes(timeline) : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Przebieg nocy</Text>

      {next ? (
        <Pressable accessibilityRole="button" onPress={run.record} style={styles.primary}>
          <Ionicons name={STEP_ICONS[next]} size={20} color={colors.teal} />
          <Text style={styles.primaryText}>{STEP_LABELS[next].action}</Text>
        </Pressable>
      ) : (
        segments?.total !== null &&
        segments?.total !== undefined && (
          <Text style={styles.summary}>
            {`Od wyjazdu do powrotu ${formatDuration(segments.total)}.`}
          </Text>
        )
      )}

      {recorded.map((step) => (
        <TimeStepper
          key={step}
          label={STEP_LABELS[step].done}
          value={new Date(timeline![step]!)}
          stepMinutes={ADJUST_MINUTES}
          onShift={(steps) => run.adjust(step, steps * ADJUST_MINUTES)}
          canShift={(steps) => run.canAdjust(step, steps * ADJUST_MINUTES)}
        />
      ))}

      {segments && (segments.travel !== null || segments.observing !== null) && (
        <Text style={styles.detail}>
          {[
            segments.travel !== null && `dojazd ${formatDuration(segments.travel)}`,
            segments.observing !== null && `na miejscu ${formatDuration(segments.observing)}`,
            segments.packAndReturn !== null &&
              `zwijanie i powrót ${formatDuration(segments.packAndReturn)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}

      {timeline?.planned && (
        <Text style={styles.detail}>
          {`Plan z chwili wyjazdu: ${formatTime(new Date(timeline.planned.departAt))} → ${formatTime(new Date(timeline.planned.returnAt))}`}
        </Text>
      )}

      {last && (
        <Pressable accessibilityRole="button" onPress={run.undo} style={styles.undo}>
          <Text style={styles.undoText}>{`Cofnij: ${STEP_LABELS[last].done.toLowerCase()}`}</Text>
        </Pressable>
      )}

      {run.failed && (
        <Text style={styles.error}>
          Nie udało się zapisać w dzienniku — poprzednie wpisy zostały nietknięte.
        </Text>
      )}
      {google.connected && needsCalendarSync(timeline) && (
        <Text style={styles.detail}>Kalendarz dostanie godziny, gdy wróci zasięg.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: HAIRLINE,
    borderTopColor: colors.border,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: hexA(colors.teal, 0.15),
  },
  primaryText: {
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    color: colors.teal,
  },
  summary: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  detail: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  undo: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  undoText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.purple,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.coral,
  },
});
