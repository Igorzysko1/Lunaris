import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Toggle } from '@/components/Toggle';
import { colors, fonts, hexA, redColors } from '@/theme';
import { Button, Chip, ChipRow, Label, Note, Panel, Sheet, todo } from '@/ui/kit';
import { pct } from '@/ui/night';

type Mode = 'red' | 'dark';

/** Trzy poziomy jasności trybu czerwonego i ich kontrast na tle #0A0303. */
const RED_LEVELS = [
  { color: redColors.textPrimary, label: 'treść, na której się działa', ratio: '7,9:1' },
  { color: redColors.textSecondary, label: 'liczby towarzyszące', ratio: '6,0:1' },
  { color: redColors.textMuted, label: 'etykiety i tło rozmowy', ratio: '4,8:1' },
];

/**
 * 16c: arkusz trybu nocnego. W terenie przełącznik musi być bez schodzenia
 * z werdyktu, dlatego arkusz, a nie podstrona. Jasność siedzi obok koloru,
 * bo jej zjazd robi więcej dla adaptacji wzroku niż sam kolor.
 */
export default function NightModeSheet() {
  const [mode, setMode] = useState<Mode>('red');
  const [brightness, setBrightness] = useState(8);
  const [auto, setAuto] = useState(true);

  return (
    <Sheet
      title="Tryb nocny"
      subtitle="Trzy palce na ekranie otwierają ten arkusz z każdego miejsca aplikacji."
    >
      <ModeOption
        selected={mode === 'red'}
        dot={redColors.textPrimary}
        title="Czerwony"
        subtitle="jedna barwa · zdjęcia wyłączone"
        onPress={() => setMode('red')}
      />
      <ModeOption
        selected={mode === 'dark'}
        dot={colors.purple}
        title="Zwykły ciemny"
        subtitle="pełna paleta"
        onPress={() => setMode('dark')}
      />

      <View style={styles.between}>
        <Text style={styles.title}>Jasność ekranu</Text>
        <Text style={styles.mono}>{brightness}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: pct(brightness / 100) }]} />
      </View>
      <ChipRow>
        {[2, 8, 20, 50].map((value) => (
          <Chip
            key={value}
            label={`${value}%`}
            tone={brightness === value ? 'accent' : 'neutral'}
            onPress={() => setBrightness(value)}
          />
        ))}
      </ChipRow>
      <Note>
        Zjazd jasności robi więcej dla adaptacji niż sam kolor, dlatego siedzi w tym samym arkuszu.
      </Note>

      <Panel style={styles.row}>
        <Text style={[styles.title, styles.flex]}>Włączaj sam po zmierzchu</Text>
        <Toggle
          value={auto}
          onPress={() => setAuto((value) => !value)}
          label="Włączaj sam po zmierzchu"
        />
      </Panel>

      <Label>Trzy poziomy, zmierzone</Label>
      <View style={styles.preview}>
        {RED_LEVELS.map((level) => (
          <View key={level.ratio} style={styles.level}>
            <Text style={[styles.levelLabel, { color: level.color }]}>{level.label}</Text>
            <Text style={[styles.mono, { color: level.color }]}>{level.ratio}</Text>
          </View>
        ))}
        <Text style={[styles.previewNote, { color: redColors.textMuted }]}>
          dobrze ✓ · uwaga ! · odpuść × · obojętne ·
        </Text>
      </View>

      <Button
        label="Zastosuj"
        variant="primary"
        onPress={() => {
          router.back();
          todo('Przełączenie całej aplikacji w tryb czerwony i sterowanie jasnością');
        }}
      />
    </Sheet>
  );
}

function ModeOption({
  selected,
  dot,
  title,
  subtitle,
  onPress,
}: {
  selected: boolean;
  dot: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.option, selected && { borderColor: dot, backgroundColor: hexA(dot, 0.12) }]}
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.flex}>
        <Text style={[styles.title, selected && { color: dot }]}>{title}</Text>
        <Text style={styles.mono}>{subtitle}</Text>
      </View>
      {selected ? <Text style={[styles.check, { color: dot }]}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  check: { fontFamily: fonts.monoSemiBold, fontSize: 18 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: { height: 6, backgroundColor: redColors.textPrimary },
  preview: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: redColors.bg,
    borderWidth: 1,
    borderColor: redColors.border,
  },
  level: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  levelLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 13.5 },
  previewNote: { fontFamily: fonts.mono, fontSize: 11.5 },
});
