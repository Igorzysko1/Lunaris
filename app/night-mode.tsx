import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Toggle } from '@/components/Toggle';
import { BRIGHTNESS_STEPS } from '@/lib/settings-storage';
import { PALETTES, colors, fonts, hexA } from '@/theme';
import { Button, Chip, ChipRow, Label, Note, Panel, Sheet } from '@/ui/kit';
import { pct } from '@/ui/night';
import { themedStyles, useTheme } from '@/ui/theme';

/**
 * Trzy poziomy jasności trybu czerwonego i ich zmierzony kontrast na tle #0A0303.
 * Progi pilnuje tests/theme.test.ts — liczby stoją tutaj po to, żeby było widać,
 * że podział na trzy stopnie jest pomiarem, a nie wrażeniem.
 */
const RED_LEVELS = [
  { color: PALETTES.red.textPrimary, label: 'treść, na której się działa', ratio: '7,5:1' },
  { color: PALETTES.red.textSecondary, label: 'liczby towarzyszące', ratio: '5,7:1' },
  { color: PALETTES.red.textMuted, label: 'etykiety i tło rozmowy', ratio: '4,6:1' },
];

/**
 * 16c: arkusz trybu nocnego. W terenie przełącznik musi być bez schodzenia
 * z werdyktu, dlatego arkusz, a nie podstrona. Jasność siedzi obok koloru,
 * bo jej zjazd robi więcej dla adaptacji wzroku niż sam kolor.
 *
 * Wybór palety przebudowuje drzewo ekranów, więc arkusz zamyka się sam — i dlatego
 * jest zestawem rzeczy działających od razu, a nie formularzem z „Zastosuj".
 */
export default function NightModeSheet() {
  const theme = useTheme();

  return (
    <Sheet
      title="Tryb nocny"
      subtitle="Trzy palce na ekranie otwierają ten arkusz z każdego miejsca aplikacji."
    >
      {/* Kropki przy wyborze biorą kolor wprost z palety, którą nazywają, a nie
          z bieżącej — to dwie próbki stojące obok siebie, więc każda ma
          wyglądać tak, jak wygląda jej tryb. */}
      <ModeOption
        selected={theme.mode === 'red'}
        dot={PALETTES.red.textPrimary}
        title="Czerwony"
        subtitle="jedna barwa · zdjęcia wyłączone"
        onPress={() => theme.setMode('red')}
      />
      <ModeOption
        selected={theme.mode === 'dark'}
        dot={PALETTES.dark.purple}
        title="Zwykły ciemny"
        subtitle="pełna paleta"
        onPress={() => theme.setMode('dark')}
      />

      <View style={styles.between}>
        <Text style={styles.title}>Jasność ekranu</Text>
        <Text style={styles.mono}>{theme.brightness}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: pct(theme.brightness / 100) }]} />
      </View>
      <ChipRow>
        {BRIGHTNESS_STEPS.map((value) => (
          <Chip
            key={value}
            label={`${value}%`}
            tone={theme.brightness === value ? 'accent' : 'neutral'}
            onPress={() => theme.setBrightness(value)}
          />
        ))}
      </ChipRow>
      <Note>
        Zjazd jasności robi więcej dla adaptacji niż sam kolor, dlatego siedzi w tym samym arkuszu.
        Obowiązuje w trybie czerwonym; po wyjściu z niego ekran wraca pod sterowanie systemu.
      </Note>

      <Panel style={styles.row}>
        <Text style={[styles.title, styles.flex]}>Włączaj sam po zmierzchu</Text>
        <Toggle value={theme.auto} onPress={theme.toggleAuto} label="Włączaj sam po zmierzchu" />
      </Panel>
      <Note>
        Automat idzie za oknem nocy dla wybranego miejsca — od zmierzchu do świtu. Wskazanie trybu
        ręcznie wyłącza go, bo wtedy obowiązuje wybór, a nie zegar.
      </Note>

      <Label>Trzy poziomy, zmierzone</Label>
      <View style={styles.preview}>
        {RED_LEVELS.map((level) => (
          <View key={level.ratio} style={styles.level}>
            <Text style={[styles.levelLabel, { color: level.color }]}>{level.label}</Text>
            <Text style={[styles.mono, { color: level.color }]}>{level.ratio}</Text>
          </View>
        ))}
        <Text style={[styles.previewNote, { color: PALETTES.red.textMuted }]}>
          dobrze ✓ · uwaga ! · odpuść × · obojętne ·
        </Text>
      </View>

      <Button label="Gotowe" variant="primary" onPress={() => router.back()} />
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

const styles = themedStyles(() => ({
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
    backgroundColor: colors.fill,
    overflow: 'hidden',
  },
  fill: { height: 6, backgroundColor: PALETTES.red.textPrimary },
  preview: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: PALETTES.red.bg,
    borderWidth: 1,
    borderColor: PALETTES.red.border,
  },
  level: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  levelLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 13.5 },
  previewNote: { fontFamily: fonts.mono, fontSize: 11.5 },
}));
