// A little Claude "burst" character — the radiating clay-orange spokes of the Claude mark,
// given two friendly eyes so the empty states have some personality. Pure react-native-svg
// (no raster asset), so it scales crisply and recolors with a prop.
import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Rect } from 'react-native-svg';

type Props = { size?: number; color?: string };

// 12 spokes around the centre, alternating long/short for the classic burst silhouette.
const SPOKES = Array.from({ length: 12 }, (_, i) => i * 30);

function ClaudeMascotImpl({ size = 96, color = '#d97757' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {SPOKES.map((angle, i) => {
        const long = i % 2 === 0;
        const len = long ? 30 : 22;
        const w = 8;
        return (
          <G key={angle} rotation={angle} origin="50, 50">
            <Rect
              x={50 - w / 2}
              y={50 - len}
              width={w}
              height={len}
              rx={w / 2}
              fill={color}
            />
          </G>
        );
      })}
      {/* Body so the face has something to sit on. */}
      <Circle cx="50" cy="50" r="20" fill={color} />
      {/* Friendly eyes. */}
      <Ellipse cx="43" cy="49" rx="3.4" ry="4.6" fill="#ffffff" />
      <Ellipse cx="57" cy="49" rx="3.4" ry="4.6" fill="#ffffff" />
      <Circle cx="43.4" cy="50" r="1.7" fill="#3a2218" />
      <Circle cx="57.4" cy="50" r="1.7" fill="#3a2218" />
    </Svg>
  );
}

export const ClaudeMascot = memo(ClaudeMascotImpl);
