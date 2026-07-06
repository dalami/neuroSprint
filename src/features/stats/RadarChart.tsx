import { View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme';
import type { SkillId } from '../games/engine/types';
import { SKILL_LABELS, SKILL_ORDER, type SkillScores } from './useStats';

interface Props {
  scores: SkillScores;
  size?: number;
}

/**
 * Radar hexagonal de habilidades, dibujado a mano con react-native-svg
 * (incluido en Expo Go — verificado contra la documentación de Expo).
 */
export function RadarChart({ scores, size = 300 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;

  const pointFor = (index: number, fraction: number): [number, number] => {
    const angle = ((-90 + index * 60) * Math.PI) / 180;
    return [cx + R * fraction * Math.cos(angle), cy + R * fraction * Math.sin(angle)];
  };

  const ringPoints = (fraction: number) =>
    SKILL_ORDER.map((_, i) => pointFor(i, fraction).join(',')).join(' ');

  const dataPoints = SKILL_ORDER.map((skill, i) =>
    pointFor(i, Math.max(0.02, scores[skill] / 100)).join(',')
  ).join(' ');

  return (
    <View>
      <Svg width={size} height={size}>
        {/* Anillos de referencia (25/50/75/100) */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Polygon
            key={f}
            points={ringPoints(f)}
            fill="none"
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        {/* Ejes */}
        {SKILL_ORDER.map((skill, i) => {
          const [x, y] = pointFor(i, 1);
          return (
            <Line
              key={skill}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}
        {/* Datos */}
        <Polygon
          points={dataPoints}
          fill={colors.primary}
          fillOpacity={0.25}
          stroke={colors.primary}
          strokeWidth={2}
        />
        {/* Etiquetas y puntajes */}
        {SKILL_ORDER.map((skill: SkillId, i) => {
          const [x, y] = pointFor(i, 1.28);
          return (
            <SvgText
              key={skill}
              x={x}
              y={y}
              fill={colors.textMuted}
              fontSize={12}
              textAnchor="middle"
            >
              {SKILL_LABELS[skill]}
            </SvgText>
          );
        })}
        {SKILL_ORDER.map((skill: SkillId, i) => {
          const [x, y] = pointFor(i, 1.28);
          return (
            <SvgText
              key={`${skill}-score`}
              x={x}
              y={y + 14}
              fill={colors.text}
              fontSize={13}
              fontWeight="bold"
              textAnchor="middle"
            >
              {scores[skill]}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
