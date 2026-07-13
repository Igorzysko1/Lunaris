import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { HAIRLINE, colors, fonts, hexA, radius } from '@/theme';

type CardProps = {
  children: React.ReactNode;
  /** `raised` is the lighter #12121F surface used by grouped rows and settings. */
  variant?: 'default' | 'raised';
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = 'default', style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === 'raised' && { backgroundColor: colors.surfaceRaised },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

type PillProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Stretches the pill to fill its row — used by the lead-time picker. */
  fill?: boolean;
};

export function Pill({ label, active, onPress, fill }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        fill ? styles.pillFill : styles.pillAuto,
        {
          backgroundColor: active ? hexA(colors.purple, 0.2) : 'transparent',
          borderColor: active ? colors.purple : colors.border,
        },
      ]}
    >
      <Text style={[styles.pillLabel, { color: active ? colors.purple : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: hexA(color, 0.15) }]}>
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillAuto: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillFill: {
    flex: 1,
    paddingVertical: 6,
  },
  pillLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  badgeLabel: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
  },
});
