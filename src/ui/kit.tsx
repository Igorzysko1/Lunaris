import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HAIRLINE, colors, fonts, hexA, radius } from '@/theme';

/**
 * Klocki nowego frontendu z projektów „Lunaris IA" i „Lunaris Noc — werdykt".
 *
 * Ekrany makiety składają się wyłącznie z tych elementów i danych z `src/mock`,
 * żeby podpinanie logiki podmieniało dane, a nie wygląd.
 */

export type Tone = 'neutral' | 'go' | 'teal' | 'warn' | 'bad' | 'accent';

export const toneColor: Record<Tone, string> = {
  neutral: colors.textSecondary,
  go: colors.green,
  teal: colors.teal,
  warn: colors.amber,
  bad: colors.coral,
  accent: colors.purple,
};

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Obrys przerywany: zapowiedź, propozycja, rzecz do dopisania. */
const DASH = 'rgba(255,255,255,0.16)';

/**
 * Przycisk bez podpiętej logiki. Makieta mówi to wprost, zamiast udawać,
 * że coś się stało — każde wywołanie to pozycja w planie podpinania.
 */
export function todo(what: string) {
  Alert.alert('Do zrobienia', `${what} — w makiecie nic tu jeszcze nie jest podpięte.`);
}

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Treść arkusza od dołu: nagłówek z krzyżykiem i przewijana zawartość. */
export function Sheet({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.sheet}
      contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.sheetHeader}>
        <View style={styles.flex}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          style={styles.close}
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      {children}
    </ScrollView>
  );
}

export function TitleBar({
  title,
  subtitle,
  right,
  onRightPress,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onRightPress?: () => void;
  back?: boolean;
}) {
  return (
    <View style={styles.titleBar}>
      {back ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Wstecz"
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.purple} />
        </Pressable>
      ) : null}
      <View style={styles.flex}>
        <Text style={back ? styles.titleSmall : styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.titleSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? (
        <Pressable
          onPress={onRightPress}
          disabled={!onRightPress}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={[styles.titleRight, onRightPress && { color: colors.purple }]}>{right}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pasek segmentów: równorzędne widoki tej samej rzeczy, zawsze pełnej szerokości. */
export function Segments<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentsWrap}>
      <View style={styles.segments}>
        {items.map(([key, label]) => {
          const active = key === value;

          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hairline} />
    </View>
  );
}

export function Panel({
  children,
  tone,
  dashed,
  raised,
  onPress,
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  dashed?: boolean;
  raised?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = tone && tone !== 'neutral' ? toneColor[tone] : null;
  const look: ViewStyle = {
    backgroundColor: accent
      ? hexA(accent, 0.07)
      : dashed
        ? 'transparent'
        : raised
          ? colors.surfaceRaised
          : colors.surface,
    borderColor: accent ? hexA(accent, 0.5) : dashed ? DASH : colors.border,
    borderStyle: dashed ? 'dashed' : 'solid',
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.panel, look, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.panel, look, style]}>{children}</View>;
}

export function Label({
  children,
  right,
  tone,
  flush,
  style,
}: {
  children: string;
  right?: string;
  tone?: Tone;
  /** Bez odstępu od góry — etykieta wewnątrz karty, a nie nad grupą. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.labelRow, flush && styles.flush, style]}>
      <Text style={[styles.label, tone && { color: toneColor[tone] }]}>
        {children.toUpperCase()}
      </Text>
      {right ? <Text style={styles.labelRight}>{right}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  tone = 'neutral',
  dashed,
  onPress,
}: {
  label: string;
  tone?: Tone;
  dashed?: boolean;
  onPress?: () => void;
}) {
  const color = toneColor[tone];
  const neutral = tone === 'neutral';
  const body = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: neutral ? 'rgba(255,255,255,0.04)' : hexA(color, 0.14),
          borderColor: neutral ? colors.border : hexA(color, 0.4),
          borderStyle: dashed ? 'dashed' : 'solid',
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: neutral ? colors.textSecondary : color }]}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={4}>
      {body}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Stat({
  label,
  value,
  tone,
  style,
}: {
  label: string;
  value: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.stat, style]}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, tone && { color: toneColor[tone] }]}>{value}</Text>
    </View>
  );
}

/** Wiersz menu: tytuł, bieżąca wartość w drugiej linijce i kierunek przejścia. */
export function MenuRow({
  title,
  subtitle,
  value,
  onPress,
  dashed,
  tone,
  chevron = '›',
}: {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  dashed?: boolean;
  tone?: Tone;
  /** `›` drill-down, `↗` link zewnętrzny, `⌄`/`⌃` zwijanie. */
  chevron?: string;
}) {
  return (
    <Panel onPress={onPress} dashed={dashed} tone={tone} style={styles.menuRow}>
      <View style={styles.flex}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Text style={styles.chevron}>{chevron}</Text>
    </Panel>
  );
}

export function Button({
  label,
  onPress,
  variant = 'outline',
  tone,
  icon,
  style,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  tone?: Tone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  /** Wyszarzony i głuchy na dotyk — np. odświeżenie w trakcie blokady po limicie zapytań. */
  disabled?: boolean;
}) {
  const color = tone && !disabled ? toneColor[tone] : colors.textMuted;
  const primary = variant === 'primary';
  const fg = primary ? colors.bg : color;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: tone ? color : colors.purple, borderColor: 'transparent' }
          : {
              borderColor: tone ? hexA(color, 0.6) : colors.border,
              backgroundColor: tone ? hexA(color, 0.06) : 'transparent',
            },
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Ostrzeżenie albo uwaga: znak przed treścią, żeby stan nie wisiał na samym kolorze. */
export function Notice({
  children,
  mark = '!',
  tone = 'warn',
  dashed,
}: {
  children: ReactNode;
  mark?: string;
  tone?: Tone;
  dashed?: boolean;
}) {
  const neutral = tone === 'neutral';

  return (
    <Panel tone={neutral ? undefined : tone} dashed={dashed} style={styles.notice}>
      <Text style={[styles.noticeMark, { color: neutral ? colors.textMuted : toneColor[tone] }]}>
        {mark}
      </Text>
      <Text style={styles.noticeText}>{children}</Text>
    </Panel>
  );
}

export function Strong({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <Text style={[styles.strong, tone && { color: toneColor[tone] }]}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function CheckBox({
  checked,
  failed,
  tone = 'go',
  onPress,
}: {
  checked: boolean;
  failed?: boolean;
  tone?: Tone;
  onPress?: () => void;
}) {
  const color = toneColor[tone];
  const box = (
    <View
      style={[
        styles.check,
        checked && { backgroundColor: color, borderColor: color },
        failed && styles.checkFailed,
      ]}
    >
      {checked ? <Ionicons name="checkmark" size={16} color={colors.bg} /> : null}
      {failed ? <Ionicons name="close" size={14} color={colors.coral} /> : null}
    </View>
  );

  if (!onPress) return box;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      {box}
    </Pressable>
  );
}

export function Field({ style, multiline, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      {...props}
      style={[styles.field, multiline && styles.fieldMultiline, style]}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, gap: 12 },
  sheet: { flex: 1, backgroundColor: colors.surfaceRaised },
  sheetContent: { padding: 16, paddingTop: 20, gap: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  sheetTitle: { fontFamily: fonts.sansMedium, fontSize: 20, color: colors.textPrimary },
  sheetSubtitle: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 4,
  },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titleBar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  back: { width: 32, height: 44, justifyContent: 'center' },
  title: { fontFamily: fonts.sansMedium, fontSize: 24, color: colors.textPrimary },
  titleSmall: { fontFamily: fonts.sansMedium, fontSize: 19, color: colors.textPrimary },
  titleSubtitle: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  titleRight: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.textSecondary },
  segmentsWrap: { gap: 12 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: hexA(colors.purple, 0.2), borderColor: colors.purple },
  segmentLabel: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  segmentLabelActive: { fontFamily: fonts.monoMedium, color: colors.purple },
  hairline: { height: 1, backgroundColor: colors.border },
  panel: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  pressed: { opacity: 0.7 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  flush: { marginTop: 0 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.textMuted },
  labelRight: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textMuted },
  chip: { borderRadius: radius.sm + 2, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 9 },
  chipLabel: { fontFamily: fonts.mono, fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stat: { gap: 5 },
  statLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.textMuted },
  statValue: { fontFamily: fonts.monoMedium, fontSize: 17, color: colors.textPrimary },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  menuTitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary },
  menuSubtitle: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 3,
  },
  menuValue: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.textSecondary },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
  button: {
    minHeight: 48,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  buttonLabel: { fontFamily: fonts.sansMedium, fontSize: 15 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeMark: { fontFamily: fonts.monoSemiBold, fontSize: 14, lineHeight: 20, width: 10 },
  noticeText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  strong: { fontFamily: fonts.monoMedium, color: colors.textPrimary },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.textPrimary },
  note: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
  check: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkFailed: { borderColor: hexA(colors.coral, 0.6), borderStyle: 'dashed' },
  field: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: HAIRLINE * 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textPrimary,
  },
  fieldMultiline: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
});
