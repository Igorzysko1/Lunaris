import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { HAIRLINE, colors, fonts, radius } from '@/theme';

/**
 * Wiersz z liczbą edytowaną ręcznie.
 *
 * Stan tekstowy jest lokalny, bo w trakcie pisania pole bywa puste albo
 * niedokończone („7", zanim padnie „70") — do konfiguracji trafia dopiero gotowa
 * wartość, a niepoprawny wpis cofa się do ostatniej dobrej.
 *
 * Przycinamy tu, a nie dopiero w konfiguracji, żeby pole pokazywało wartość
 * faktycznie zapisaną: po wpisaniu apertury 5000 mm ma zostać 400, a nie 5000.
 */
export function NumberRow({
  label,
  unit,
  value,
  limits,
  onCommit,
}: {
  label: string;
  unit: string;
  value: number;
  limits: { min: number; max: number };
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  const commit = () => {
    const parsed = Number(text.replace(',', '.'));

    if (!Number.isFinite(parsed)) {
      setText(String(value));
      return;
    }

    const clamped = Math.min(limits.max, Math.max(limits.min, parsed));
    setText(String(clamped));
    onCommit(clamped);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          style={styles.input}
          accessibilityLabel={label}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textPrimary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  input: {
    minWidth: 54,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
    minWidth: 26,
  },
});
