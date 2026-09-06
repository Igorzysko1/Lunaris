import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/primitives';
import { TYPE_META, type AstroEvent } from '@/data/events';
import { formatTime } from '@/lib/date';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

type Props = {
  event: AstroEvent;
  /** Text shown in place of the time, e.g. "Dziś · 22:40" on the home screen. */
  timeLabel?: string;
  /** The list clamps descriptions to two lines; the home card shows them in full. */
  clampDescription?: boolean;
};

export function EventCard({ event, timeLabel, clampDescription }: Props) {
  const meta = TYPE_META[event.type];

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: meta.color }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Badge label={meta.label} color={meta.color} />
          <Text style={styles.time}>{timeLabel ?? formatTime(event.at)}</Text>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{event.title}</Text>
          <Text
            style={[
              styles.visibility,
              { color: event.visible ? colors.teal : colors.textMuted },
            ]}
          >
            {event.visible ? 'WIDOCZNY' : 'NIEWIDOCZNY'}
          </Text>
        </View>

        <Text style={styles.desc} numberOfLines={clampDescription ? 2 : undefined}>
          {event.desc}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  visibility: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  desc: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
