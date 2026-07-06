import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const QUESTIONS = 4;
const FEEDBACK_MS = 900;

type Grid = boolean[][];

function matrixSize(level: number): number {
  return level <= 25 ? 3 : level <= 60 ? 4 : 5;
}

/** Rotación 90° horaria */
function rotate(g: Grid): Grid {
  return g[0].map((_, i) => g.map((row) => row[i]).reverse());
}

/** Espejo horizontal */
function mirror(g: Grid): Grid {
  return g.map((row) => [...row].reverse());
}

function serialize(g: Grid): string {
  return g.map((row) => row.map((c) => (c ? '1' : '0')).join('')).join('|');
}

function randomGrid(size: number): Grid {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Math.random() < 0.45)
  );
}

/** Cambia una celda al azar (para generar distractores) */
function mutate(g: Grid): Grid {
  const size = g.length;
  const r = Math.floor(Math.random() * size);
  const c = Math.floor(Math.random() * size);
  return g.map((row, i) => row.map((cell, j) => (i === r && j === c ? !cell : cell)));
}

interface Question {
  target: Grid;
  options: Grid[];
  correctIndex: number;
}

function makeQuestion(size: number, kind: 'rotated' | 'mirrored'): Question {
  // Figura asimétrica: sus 4 rotaciones deben ser todas distintas
  // y su espejo no debe coincidir con ninguna rotación.
  let target = randomGrid(size);
  for (let attempt = 0; attempt < 30; attempt++) {
    const rots = [target];
    for (let i = 0; i < 3; i++) rots.push(rotate(rots[i]));
    const rotSet = new Set(rots.map(serialize));
    const mirrorInRots = rotSet.has(serialize(mirror(target)));
    if (rotSet.size === 4 && !mirrorInRots) break;
    target = randomGrid(size);
  }

  const rotations = [target];
  for (let i = 0; i < 3; i++) rotations.push(rotate(rotations[i]));
  const rotSet = new Set(rotations.map(serialize));

  // Familia de espejos: por la asimetría garantizada, disjunta de las rotaciones
  const mirrors: Grid[] = [];
  let mm = mirror(target);
  for (let i = 0; i < 4; i++) {
    mirrors.push(mm);
    mm = rotate(mm);
  }
  const mirrorSet = new Set(mirrors.map(serialize));

  // Correcta: rotación no trivial (modo rotada) o un espejo (modo espejada)
  const correct =
    kind === 'rotated'
      ? rotations[1 + Math.floor(Math.random() * 3)]
      : mirrors[Math.floor(Math.random() * mirrors.length)];

  // Distractores: la familia opuesta, nunca la familia de la correcta
  const correctFamily = kind === 'rotated' ? rotSet : mirrorSet;
  const distractors: Grid[] = [];
  const used = new Set<string>([serialize(correct)]);
  const candidates: Grid[] =
    kind === 'rotated' ? mirrors : rotations.slice(1);
  for (const c of candidates) {
    const s = serialize(c);
    if (!correctFamily.has(s) && !used.has(s)) {
      distractors.push(c);
      used.add(s);
      if (distractors.length === 3) break;
    }
  }
  // Fallback por si la figura salió con alguna simetría: mutaciones
  let guard = 0;
  while (distractors.length < 3 && guard < 100) {
    guard++;
    const base = (kind === 'rotated' ? rotations : mirrors)[
      Math.floor(Math.random() * 4)
    ];
    const c = mutate(base);
    const s = serialize(c);
    if (!correctFamily.has(s) && !used.has(s)) {
      distractors.push(c);
      used.add(s);
    }
  }

  const options = [correct, ...distractors];
  // mezcla
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    target,
    options,
    correctIndex: options.findIndex((o) => serialize(o) === serialize(correct)),
  };
}

function MiniGrid({ grid, cellSize }: { grid: Grid; cellSize: number }) {
  return (
    <View>
      {grid.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {row.map((cell, j) => (
            <View
              key={j}
              style={{
                width: cellSize,
                height: cellSize,
                margin: 1,
                borderRadius: 2,
                backgroundColor: cell ? colors.primary : colors.surface,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function SpatialRotationGame({ gameId, level, onFinish }: GameProps) {
  const size = matrixSize(level);

  // La consigna se sortea: buscar la ROTADA o la ESPEJADA (desde nivel 15)
  const [kind] = useState<'rotated' | 'mirrored'>(() =>
    level >= 15 && Math.random() < 0.5 ? 'mirrored' : 'rotated'
  );
  const [questions] = useState<Question[]>(() =>
    Array.from({ length: QUESTIONS }, () => makeQuestion(size, kind))
  );
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  const correctRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleOption = (optIndex: number) => {
    if (chosen !== null) return;
    setChosen(optIndex);
    if (optIndex === questions[index].correctIndex) correctRef.current += 1;

    timerRef.current = setTimeout(() => {
      setChosen(null);
      if (index + 1 < QUESTIONS) {
        setIndex(index + 1);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish({
          gameId,
          level,
          score: correctRef.current * 100,
          accuracy: Math.round((correctRef.current / QUESTIONS) * 100),
          durationSeconds: Math.max(
            1,
            Math.round((Date.now() - startedAtRef.current) / 1000)
          ),
        });
      }
    }, FEEDBACK_MS);
  };

  const q = questions[index];
  const targetCell = Math.floor(120 / size);
  const optionCell = Math.floor(72 / size);

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {QUESTIONS} · nivel {level}
      </Text>
      <Text style={styles.hint}>
        {kind === 'rotated'
          ? '¿Cuál es la misma figura, ROTADA? (las espejadas no valen)'
          : '¿Cuál es la figura ESPEJADA? (las rotaciones no valen)'}
      </Text>
      <MiniGrid grid={q.target} cellSize={targetCell} />
      <View style={styles.optionsGrid}>
        {q.options.map((opt, i) => {
          const showResult = chosen !== null && (i === chosen || i === q.correctIndex);
          const good = i === q.correctIndex;
          return (
            <Pressable
              key={i}
              onPress={() => handleOption(i)}
              style={({ pressed }) => [
                styles.option,
                pressed && chosen === null && styles.optionPressed,
                showResult && {
                  borderColor: good ? colors.success : colors.danger,
                  borderWidth: 2,
                },
              ]}
            >
              <MiniGrid grid={opt} cellSize={optionCell} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  progress: {
    position: 'absolute',
    top: spacing.lg,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 15,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  option: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  optionPressed: {
    opacity: 0.7,
  },
});
