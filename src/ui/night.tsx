import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { colors, fonts, hexA } from '@/theme';
import { themedStyles } from '@/ui/theme';

/**
 * Ile szerokości paska zajmuje podpis godziny („01:23" przy 10,5 pt) — poniżej
 * tej odległości dwa podpisy na siebie wchodzą.
 */
const LABEL_CLEARANCE = 0.16;

/**
 * Podpis przy znaczniku, ale nie za krawędzią paska: przy brzegu przyklejamy
 * go do brzegu zamiast centrować, bo wycentrowany wyjechałby poza ekran.
 */
function placeLabel(at: number) {
  if (at < LABEL_CLEARANCE) return { left: 0 };
  if (at > 1 - LABEL_CLEARANCE) return { right: 0 };
  return { left: pct(at), transform: [{ translateX: -20 }] };
}

/** Ułamek szerokości jako procent w stylu React Native. */
export function pct(fraction: number): `${number}%` {
  return `${Math.round(fraction * 1000) / 10}%`;
}

/** Kreskowanie: niebo jeszcze albo już jasne — zmierzch albo Księżyc nad horyzontem. */
function Hatch({
  from,
  to,
  color = colors.borderDashed,
}: {
  from: number;
  to: number;
  color?: string;
}) {
  const id = `hatch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  if (to <= from) return null;

  return (
    <View style={[styles.layer, { left: pct(from), width: pct(to - from) }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id={id}
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform="rotate(45)"
          >
            <Line x1={0} y1={0} x2={0} y2={6} stroke={color} strokeWidth={2} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * Pasek nocy: zmierzch, ciemność, okno obserwacyjne, Księżyc nad horyzontem i „teraz".
 * Znacznik Księżyca stoi przy wschodzie, a gdy Księżyc świeci od zmierzchu — przy zachodzie.
 */
export function WindowBar({
  darkFrom,
  windowFrom,
  windowTo,
  moonRise,
  moonSet = 1,
  now,
  labels,
}: {
  darkFrom: number;
  windowFrom: number;
  windowTo: number;
  moonRise: number;
  moonSet?: number;
  now?: number | null;
  labels: { start: string; moon: string; end: string };
}) {
  const moonMark =
    moonRise > 0 && moonRise < 1 ? moonRise : moonSet > 0 && moonSet < 1 ? moonSet : null;
  const showNow = now !== undefined && now !== null;

  // Podpis Księżyca stoi tam, gdzie Księżyc wschodzi albo zachodzi — a to bywa
  // tuż przy zmierzchu, świcie albo „teraz". Wtedy schodzi rząd niżej, zamiast
  // wejść na sąsiedni podpis. Żaden nie znika, bo każdy niesie inną godzinę.
  const moonClashes =
    moonMark !== null &&
    (moonMark < LABEL_CLEARANCE ||
      moonMark > 1 - LABEL_CLEARANCE ||
      (now != null && Math.abs(moonMark - now) < LABEL_CLEARANCE));
  const moonLabel =
    moonMark !== null && labels.moon ? (
      <Text style={[styles.axis, styles.moonText, placeLabel(moonMark)]}>{labels.moon}</Text>
    ) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <Hatch from={0} to={darkFrom} />
        <Hatch from={moonRise} to={moonSet} />
        <View
          style={[styles.window, { left: pct(windowFrom), width: pct(windowTo - windowFrom) }]}
        />
        {moonMark !== null ? (
          <View style={[styles.marker, styles.moon, { left: pct(moonMark) }]} />
        ) : null}
        {showNow ? <View style={[styles.marker, styles.now, { left: pct(now) }]} /> : null}
      </View>
      <View style={styles.labels}>
        <Text style={[styles.axis, styles.start]}>{labels.start}</Text>
        {showNow ? (
          <Text style={[styles.axis, styles.nowLabel, { left: pct(now) }]}>teraz</Text>
        ) : null}
        {moonClashes ? null : moonLabel}
        <Text style={[styles.axis, styles.end]}>{labels.end}</Text>
      </View>
      {moonClashes ? <View style={styles.labels}>{moonLabel}</View> : null}
    </View>
  );
}

/** Postęp sesji w trakcie nocy (9b). */
export function ProgressBar({
  progress,
  start,
  end,
}: {
  progress: number;
  start: string;
  end: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.window, styles.progress, { width: pct(progress) }]} />
        <View style={[styles.marker, styles.now, { left: pct(progress) }]} />
      </View>
      <View style={styles.labels}>
        <Text style={[styles.axis, styles.start]}>{start}</Text>
        <Text style={[styles.axis, styles.nowLabel, { left: pct(progress) }]}>teraz</Text>
        <Text style={[styles.axis, styles.end]}>{end}</Text>
      </View>
    </View>
  );
}

/** Pasek nocy odrzuconej: zakreskowany w całości, bo okna nie ma wcale (2b). */
export function BlockedBar({ label }: { label: string }) {
  return (
    <View style={styles.track}>
      <Hatch from={0} to={1} color={hexA(colors.coral, 0.4)} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text
          style={[
            styles.axis,
            { position: 'relative', letterSpacing: 1.5, color: colors.textPrimary },
          ]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Słupki godzinowe z podświetlonym oknem — zachmurzenie i profil wysokości celu. */
export function HourBars({
  values,
  max = 100,
  highlight,
  axis,
  threshold,
  height = 64,
}: {
  values: number[];
  max?: number;
  /** Okno sesji w indeksach słupków; `null`, gdy noc okna nie ma. */
  highlight: [number, number] | null;
  axis: { slot: number; label: string }[];
  threshold?: number;
  height?: number;
}) {
  const slots = values.length;

  return (
    <View style={styles.wrap}>
      <View style={[styles.bars, { height }]}>
        {values.map((value, i) => {
          const inWindow = highlight !== null && i >= highlight[0] && i <= highlight[1];

          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: Math.max(3, (value / max) * height),
                  backgroundColor: inWindow ? hexA(colors.green, 0.6) : colors.fill,
                },
              ]}
            />
          );
        })}
        {highlight ? (
          <View
            style={[
              styles.highlight,
              {
                left: pct(highlight[0] / slots),
                width: pct((highlight[1] - highlight[0] + 1) / slots),
              },
            ]}
          />
        ) : null}
        {threshold !== undefined ? (
          <View style={[styles.threshold, { bottom: (threshold / max) * height }]} />
        ) : null}
      </View>
      <View style={styles.labels}>
        {axis.map((tick) => (
          <Text key={tick.label} style={[styles.axis, { left: pct(tick.slot / slots) }]}>
            {tick.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: 6 },
  track: {
    height: 26,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: colors.fillSoft,
  },
  layer: { position: 'absolute', top: 0, bottom: 0 },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: hexA(colors.green, 0.3),
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: hexA(colors.green, 0.8),
  },
  progress: { left: 0, borderLeftWidth: 0 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  moon: { backgroundColor: colors.amber },
  now: { backgroundColor: colors.textPrimary },
  labels: { height: 14 },
  axis: {
    position: 'absolute',
    top: 0,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.textMuted,
  },
  start: { left: 0 },
  end: { right: 0 },
  nowLabel: { color: colors.textPrimary, transform: [{ translateX: -12 }] },
  moonText: { color: colors.amber },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bar: { flex: 1, borderRadius: 2 },
  highlight: {
    position: 'absolute',
    top: -4,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: hexA(colors.green, 0.5),
  },
  threshold: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: hexA(colors.coral, 0.6),
  },
}));
