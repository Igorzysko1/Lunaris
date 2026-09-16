import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { CONSTELLATIONS } from '@/data/constellations';
import { useConstellationView } from '@/hooks/use-constellation-tonight';
import { useDeviceRoll } from '@/hooks/use-device-roll';
import { FIGURES } from '@/mock/constellation-figures';
import { colors, fonts } from '@/theme';
import { ConstellationFigure } from '@/ui/figure';
import { Body, Button, Label, Note, Panel, Sheet } from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

const EASE: Record<1 | 2 | 3, string> = {
  1: 'nie do pomylenia',
  2: 'trzeba wiedzieć, czego szukać',
  3: 'trudny, bez jasnego kształtu',
};

/** Obrót skokami po 15° — w rękawicach pewniejszy niż przeciąganie. */
const STEP = 15;

/**
 * 7a/8a: panel gwiazdozbioru. Nazwy, kotwica, podpowiedź i łatwość z katalogu;
 * „gdzie szukać" i ułożenie nad horyzontem z efemeryd; obiekty z granic IAU.
 * Kształt figury jest schematyczny (decyzja 15 września) — obrót liczy się dla
 * środka gwiazdozbioru.
 */
export default function ConstellationSheet() {
  const { id, night } = useLocalSearchParams<{ id: string; night?: string }>();
  const meta = CONSTELLATIONS.find((c) => c.id === id) ?? CONSTELLATIONS[0];
  const view = useConstellationView(meta, night);
  const figure = FIGURES[meta.id];
  const [offset, setOffset] = useState(0);
  const [gyro, setGyro] = useState(false);
  const motion = useDeviceRoll(gyro);

  const following = gyro && motion.roll !== null;
  const rotation = following ? view.skyRotation - (motion.roll ?? 0) : view.skyRotation + offset;
  const shift = ((offset % 360) + 360) % 360;
  const rotationLabel = gyro
    ? motion.available === false
      ? 'czujnik ruchu niedostępny — potrzebny nowy build'
      : 'podąża za telefonem'
    : shift === 0
      ? view.orientation
      : shift <= 180
        ? `+${shift}° od ułożenia na niebie`
        : `−${360 - shift}° od ułożenia na niebie`;

  function rotate(delta: number) {
    setGyro(false);
    setOffset((value) => value + delta);
  }

  return (
    <Sheet title={meta.name} subtitle={`${meta.latin} · kotwica: ${meta.star}`}>
      <Panel>
        <Label flush>Gdzie szukać</Label>
        <Text style={styles.where}>{view.where}</Text>
        <Body>{meta.hint}</Body>
        <Text style={[styles.ease, meta.ease === 3 && styles.easeHard]}>● {EASE[meta.ease]}</Text>
      </Panel>

      <Panel>
        <Label flush right={rotationLabel}>
          Jak stoi na niebie
        </Label>
        <View style={styles.figure}>
          {figure ? (
            <ConstellationFigure figure={figure} rotation={rotation} size={280} />
          ) : (
            <Note>Brak rysunku w danych.</Note>
          )}
        </View>
        <View style={styles.controls}>
          <Button label="↺" onPress={() => rotate(-STEP)} style={styles.rotate} />
          <Button
            label="jak widzisz teraz"
            tone={shift === 0 && !gyro ? 'accent' : undefined}
            onPress={() => {
              setGyro(false);
              setOffset(0);
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
            setOffset(0);
          }}
        />
        <Note>Kształt jest schematyczny; obrót liczy się dla środka gwiazdozbioru.</Note>
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

      <Label right={`${view.targets.length} w katalogu`}>Obiekty w tym gwiazdozbiorze</Label>
      {view.targets.length === 0 ? (
        <Note>W katalogu nie ma obiektów w granicach tego gwiazdozbioru.</Note>
      ) : null}
      {view.targets.map((target) => (
        <Panel
          key={target.id}
          onPress={() =>
            router.push({ pathname: '/library/target/[id]', params: { id: target.id } })
          }
          style={styles.row}
        >
          <Text style={[styles.reach, !target.reach && styles.outOfReach]}>
            {target.reach ? '●' : '○'}
          </Text>
          <View style={styles.flex}>
            <Text style={styles.title}>{target.designation}</Text>
            <Text style={styles.subtitle}>{target.detail}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Panel>
      ))}
    </Sheet>
  );
}

const styles = themedStyles(() => ({
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
  reach: { width: 14, fontSize: 10, color: colors.purple },
  outOfReach: { color: colors.textMuted },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
}));
