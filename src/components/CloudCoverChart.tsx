import { Line, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { CHART_TIMES } from '@/data/night';
import { cloudBarColor } from '@/lib/astro';
import { colors, fonts } from '@/theme';

const WIDTH = 336;
const HEIGHT = 150;
const PLOT_TOP = 6;
const PLOT_BASE = 120;
const PLOT_HEIGHT = PLOT_BASE - PLOT_TOP;

const GRID_LINES = [0, 25, 50, 75, 100];
/** Only every fourth slot gets a label, otherwise they collide. */
const LABELLED_SLOTS = [1, 5, 9, 13];

const MARKERS = [
  { x: 3, label: '20:43', anchor: 'start', dx: 4 },
  { x: WIDTH - 3, label: '04:28', anchor: 'end', dx: -4 },
] as const;

export function CloudCoverChart({ bars }: { bars: number[] }) {
  const slot = WIDTH / bars.length;
  const barWidth = Math.min(10, slot - 4);
  const y = (value: number) => PLOT_BASE - (value / 100) * PLOT_HEIGHT;

  return (
    <Svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT}>
      {GRID_LINES.map((value) => (
        <Line
          key={`grid-${value}`}
          x1={0}
          x2={WIDTH}
          y1={y(value)}
          y2={y(value)}
          stroke={colors.grid}
          strokeWidth={1}
        />
      ))}

      {bars.map((value, i) => (
        <Rect
          key={`bar-${i}`}
          x={i * slot + (slot - barWidth) / 2}
          y={y(value)}
          width={barWidth}
          height={PLOT_BASE - y(value)}
          rx={2}
          fill={cloudBarColor(value)}
        />
      ))}

      {LABELLED_SLOTS.map((i) => (
        <SvgText
          key={`time-${i}`}
          x={i * slot + slot / 2}
          y={139}
          fill={colors.textMuted}
          fontSize={10}
          fontFamily={fonts.mono}
          textAnchor="middle"
        >
          {CHART_TIMES[i]}
        </SvgText>
      ))}

      {MARKERS.map((marker) => (
        <Line
          key={`marker-line-${marker.label}`}
          x1={marker.x}
          x2={marker.x}
          y1={0}
          y2={PLOT_BASE}
          stroke={colors.purple}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.45}
        />
      ))}
      {MARKERS.map((marker) => (
        <SvgText
          key={`marker-text-${marker.label}`}
          x={marker.x + marker.dx}
          y={11}
          fill={colors.purple}
          fontSize={9}
          fontFamily={fonts.mono}
          textAnchor={marker.anchor}
          opacity={0.85}
        >
          {marker.label}
        </SvgText>
      ))}
    </Svg>
  );
}
