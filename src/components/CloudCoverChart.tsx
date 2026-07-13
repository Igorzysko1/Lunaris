import { Line, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { cloudBarColor } from '@/lib/astro';
import type { NightForecast } from '@/lib/weather';
import { colors, fonts } from '@/theme';

const WIDTH = 336;
const HEIGHT = 150;
const PLOT_TOP = 6;
const PLOT_BASE = 120;
const PLOT_HEIGHT = PLOT_BASE - PLOT_TOP;

const GRID_LINES = [0, 25, 50, 75, 100];

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function CloudCoverChart({ forecast }: { forecast: NightForecast }) {
  const { hours, from, to } = forecast;

  const slot = WIDTH / hours.length;
  const barWidth = Math.min(14, slot - 4);
  const y = (value: number) => PLOT_BASE - (value / 100) * PLOT_HEIGHT;

  // Przy krótkich letnich nocach słupków jest mało, przy zimowych sporo —
  // podpisujemy co drugi/trzeci, żeby etykiety się nie zlewały.
  const labelEvery = hours.length > 10 ? 3 : 2;

  const markers = [
    { x: 3, label: hhmm(from), anchor: 'start', dx: 4 },
    { x: WIDTH - 3, label: hhmm(to), anchor: 'end', dx: -4 },
  ] as const;

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

      {hours.map((hour, i) => (
        <Rect
          key={`bar-${hour.at.getTime()}`}
          x={i * slot + (slot - barWidth) / 2}
          y={y(hour.cloud)}
          width={barWidth}
          height={PLOT_BASE - y(hour.cloud)}
          rx={2}
          fill={cloudBarColor(hour.cloud)}
        />
      ))}

      {hours.map((hour, i) =>
        i % labelEvery === 0 ? (
          <SvgText
            key={`time-${hour.at.getTime()}`}
            x={i * slot + slot / 2}
            y={139}
            fill={colors.textMuted}
            fontSize={10}
            fontFamily={fonts.mono}
            textAnchor="middle"
          >
            {hhmm(hour.at)}
          </SvgText>
        ) : null,
      )}

      {markers.map((marker) => (
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
      {markers.map((marker) => (
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
