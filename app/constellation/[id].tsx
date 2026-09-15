import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CONSTELLATIONS } from '@/data/constellations';
import { useConstellationTonight } from '@/hooks/use-constellation-tonight';
import { FIGURES, FIGURE_TARGETS } from '@/mock/constellation-figures';
import { colors, fonts } from '@/theme';
import { ConstellationFigure } from '@/ui/figure';
import { Body, Button, Label, Note, Panel, Sheet } from '@/ui/kit';

const EASE: Record<1 | 2 | 3, string> = {
  1: 'nie do pomylenia',
  2: 'trzeba wiedzieć, czego szukać',
  3: 'trudny, bez jasnego kształtu',
};

/** Obrót skokami po 15° — w rękawicach pewniejszy niż przeciąganie. */
const STEP = 15;

/**
 * 7a/8a: panel gwiazdozbioru. Nazwy, kotwica, podpowiedź i łatwość pochodzą
 * z `src/data/constellations.ts`, „gdzie szukać" — z efemeryd nocy wybranej
 * w Niebie (bez niej: nocy bieżącej); kształt z makiety pola `figure`.
 */
export default function ConstellationSheet() {
  const { id, night } = useLocalSearchParams<{ id: string; night?: string }>();
  const meta = CONSTELLATIONS.find((c) => c.id === id) ?? CONSTELLATIONS[0];
  const where = useConstellationTonight(meta, night);
  const figure = FIGURES[meta.id];
  const targets = FIGURE_TARGETS[meta.id] ?? [];
  const [rotation, setRotation] = useState(0);
  const [gyro, setGyro] = useState(false);

  const normalized = ((rotation % 360) + 360) % 360;
  const rotationLabel = gyro
    ? 'podąża za telefonem'
    : normalized === 0
      ? 'orientacja rzeczywista'
      : normalized <= 180
        ? `+${normalized}°`
        : `−${360 - normalized}°`;

  function rotate(delta: number) {
    setGyro(false);
    setRotation((value) => value + delta);
  }

  return (
    <Sheet title={meta.name} subtitle={`${meta.latin} · kotwica: ${meta.star}`}>
      <Panel>
        <Label flush>Gdzie szukać</Label>
        <Text style={styles.where}>{where}</Text>
        <Body>{meta.hint}</Body>
        <Text style={[styles.ease, meta.ease === 3 && styles.easeHard]}>● {EASE[meta.ease]}</Text>
      </Panel>

      <Panel>
        <Label flush right={rotationLabel}>
          Jak stoi na niebie
        </Label>
        <View style={styles.figure}>
          {figure ? (
            <ConstellationFigure figure={figure} rotation={gyro ? 0 : rotation} size={280} />
          ) : (
            <Note>Brak rysunku w danych.</Note>
          )}
        </View>
        <View style={styles.controls}>
          <Button label="↺" onPress={() => rotate(-STEP)} style={styles.rotate} />
          <Button
            label="jak widzisz teraz"
            tone={normalized === 0 && !gyro ? 'accent' : undefined}
            onPress={() => {
              setGyro(false);
              setRotation(0);
            }}
            style={styles.flex}
          />
          <Button label="↻" onPress={() => rotate(STEP)} style={styles.rotate} />
        </View>
        <Button
          label={gyro ? 'żyroskop włączony — dotknij, by zatrzymać' : 'podążaj za telefonem'}
          icon="compass-outline"
          tone={gyro ? 'accent' : undefined}
          onPress={() => {
            setGyro((value) => !value);
            setRotation(0);
          }}
        />
      </Panel>

      {figure ? (
        <>
          <Label right="kształt schematyczny">Gwiazdy rysunku</Label>
          {figure.s.map(([, , bayer, name]) => (
            <Panel key={`${bayer}-${name ?? ''}`} style={styles.row}>
              <Text style={styles.bayer}>{bayer}</Text>
              <Text style={[styles.title, styles.flex]}>{name ?? 'nazwy nie ma w danych'}</Text>
              {name === meta.star ? <Text style={styles.anchor}>KOTWICA</Text> : null}
            </Panel>
          ))}
        </>
      ) : null}

      <Label right={`${targets.length} ${targets.length === 1 ? 'cel' : 'cele'} z podpowiedzi`}>
        Cele w tym gwiazdozbiorze
      </Label>
      {targets.length ? (
        targets.map(([designation, detail]) => (
          <Panel
            key={designation}
            onPress={() =>
              router.push({
                pathname: '/library/target/[id]',
                params: { id: designation.split(' ')[0].toLowerCase() },
              })
            }
            style={styles.row}
          >
            <View style={styles.flex}>
              <Text style={styles.title}>{designation}</Text>
              <Text style={styles.subtitle}>{detail}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Panel>
        ))
      ) : (
        <Note>
          Podpowiedź katalogu nie wymienia tu obiektów. W aplikacji listę dobiera filtr celów po
          współrzędnych i progach optyki, więc puste miejsce nie znaczy „nic nie ma”.
        </Note>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  where: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  ease: { fontFamily: fonts.mono, fontSize: 12, color: colors.green },
  easeHard: { color: colors.textMuted },
  figure: { alignItems: 'center', paddingVertical: 8 },
  controls: { flexDirection: 'row', gap: 8 },
  rotate: { width: 56, paddingHorizontal: 0 },
  title: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  bayer: { width: 18, fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted },
  anchor: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.purple,
  },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
});
