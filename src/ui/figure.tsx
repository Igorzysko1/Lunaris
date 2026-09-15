import { useEffect, useState } from 'react';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';

import type { Figure } from '@/mock/constellation-figures';
import { colors, fonts, hexA } from '@/theme';

/** Kadr rysunku: 220×220, środek w 110. */
const CENTER = 110;

/** Nazwa dotkniętej gwiazdy trzyma się 2,6 s — pięć podpisów naraz zasłoniłoby kształt. */
const LABEL_MS = 2600;

/**
 * Rysunek gwiazdozbioru obracany o `rotation` stopni wokół środka kadru.
 * `compact` to miniatura do galerii: bez podpisów i bez dotyku.
 */
export function ConstellationFigure({
  figure,
  rotation,
  size,
  compact = false,
}: {
  figure: Figure;
  rotation: number;
  size: number;
  compact?: boolean;
}) {
  const [tapped, setTapped] = useState<number | null>(null);

  useEffect(() => {
    if (tapped === null) return;
    const timer = setTimeout(() => setTapped(null), LABEL_MS);
    return () => clearTimeout(timer);
  }, [tapped]);

  const scale = compact ? 80 : 86;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const points = figure.s.map(([x, y, bayer, name]) => ({
    x: CENTER + (x * cos - y * sin) * scale,
    y: CENTER - (x * sin + y * cos) * scale,
    bayer,
    name,
  }));
  const active = tapped === null ? null : points[tapped];

  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      {compact ? null : (
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={106}
          stroke={colors.border}
          strokeWidth={1}
          fill="none"
        />
      )}
      {figure.l.map((line, i) => (
        <Polyline
          key={i}
          points={line.map((j) => `${points[j].x.toFixed(1)},${points[j].y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke={hexA(colors.purple, 0.6)}
          strokeWidth={compact ? 2 : 1.5}
        />
      ))}
      {points.map((point, i) => (
        <Circle
          key={`star-${i}`}
          cx={point.x}
          cy={point.y}
          r={i === 0 ? (compact ? 3.4 : 4.4) : compact ? 2.4 : 3.2}
          fill={colors.textPrimary}
        />
      ))}
      {compact
        ? null
        : points.map((point, i) => {
            const dx = point.x - CENTER;
            const dy = point.y - CENTER;
            const length = Math.max(1, Math.hypot(dx, dy));

            return (
              <SvgText
                key={`bayer-${i}`}
                x={point.x + (dx / length) * 13}
                y={point.y + (dy / length) * 13 + 3}
                fontSize={10}
                fontFamily={fonts.mono}
                fill={colors.textMuted}
                textAnchor="middle"
              >
                {point.bayer}
              </SvgText>
            );
          })}
      {compact
        ? null
        : points.map((point, i) => (
            // Pole dotyku większe niż sama gwiazda: trafia się w widoczny punkt, w rękawicach.
            <Circle
              key={`hit-${i}`}
              cx={point.x}
              cy={point.y}
              r={17}
              fill="transparent"
              onPress={() => setTapped(i)}
            />
          ))}
      {active ? (
        <SvgText
          x={active.x}
          y={active.y - 12}
          fontSize={11}
          fontFamily={fonts.sansMedium}
          fill={colors.textPrimary}
          textAnchor="middle"
        >
          {active.name
            ? `${active.name} · ${active.bayer}`
            : `gwiazda ${active.bayer} — nazwy nie ma w danych`}
        </SvgText>
      ) : null}
    </Svg>
  );
}
