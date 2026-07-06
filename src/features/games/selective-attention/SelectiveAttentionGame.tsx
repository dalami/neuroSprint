import { useEffect, useRef, useState } from 'react';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const ROUNDS = 5;
const RULE_CHANGE_ROUND = 3; // desde nivel 40, la regla cambia en la ronda 4
const RULE_MS = 1700;
const ROUND_END_MS = 850;
const TICK_MS = 100;

type Shape = 'circle' | 'square' | 'diamond';
type StimColor = 'green' | 'red' | 'blue' | 'yellow';

const SHAPES: Shape[] = ['circle', 'square', 'diamond'];
const COLORS: StimColor[] = ['green', 'red', 'blue', 'yellow'];

const COLOR_HEX: Record<StimColor, string> = {
  green: '#2EA043',
  red: '#F85149',
  blue: '#388BFD',
  yellow: '#D29922',
};

const SHAPE_LABEL: Record<Shape, string> = {
  circle: 'círculos',
  square: 'cuadrados',
  diamond: 'rombos',
};

const COLOR_LABEL: Record<StimColor, string> = {
  green: 'verdes',
  red: 'rojos',
  blue: 'azules',
  yellow: 'amarillos',
};

interface Rule {
  shape: Shape;
  color: StimColor;
}

type Polarity = 'normal' | 'negative';

function ruleText(r: Rule, polarity: Polarity): string {
  return polarity === 'negative'
    ? `Tocá TODO MENOS los ${SHAPE_LABEL[r.shape]} ${COLOR_LABEL[r.color]}`
    : `Tocá los ${SHAPE_LABEL[r.shape]} ${COLOR_LABEL[r.color]}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRule(exclude?: Rule): Rule {
  for (;;) {
    const r: Rule = {
      shape: SHAPES[randInt(0, SHAPES.length - 1)],
      color: COLORS[randInt(0, COLORS.length - 1)],
    };
    if (!exclude || r.shape !== exclude.shape || r.color !== exclude.color) {
      return r;
    }
  }
}

/** Curvas de dificultad: más figuras, más chicas y menos tiempo */
function config(level: number) {
  const figures = Math.min(14, 6 + Math.floor(level / 8));
  const targets = Math.min(figures - 2, Math.max(2, Math.round(figures * 0.4)));
  const size = Math.max(44, 78 - Math.floor(level * 0.5));
  const roundMs = Math.max(2500, 6500 - level * 45);
  return { figures, targets, size, roundMs };
}

interface Figure {
  id: number;
  shape: Shape;
  color: StimColor;
  isTarget: boolean;
  topPct: number;
  leftPct: number;
}

/** Distractor con sesgo hacia los "tramposos" (comparten forma o color) */
function distractorFor(rule: Rule): { shape: Shape; color: StimColor } {
  if (Math.random() < 0.55) {
    if (Math.random() < 0.5) {
      const others = COLORS.filter((c) => c !== rule.color);
      return { shape: rule.shape, color: others[randInt(0, others.length - 1)] };
    }
    const others = SHAPES.filter((s) => s !== rule.shape);
    return { shape: others[randInt(0, others.length - 1)], color: rule.color };
  }
  for (;;) {
    const shape = SHAPES[randInt(0, SHAPES.length - 1)];
    const color = COLORS[randInt(0, COLORS.length - 1)];
    if (shape !== rule.shape || color !== rule.color) return { shape, color };
  }
}

/** Figuras en slots de una grilla 4×5 con jitter: nunca se superponen */
function makeRoundFigures(
  rule: Rule,
  figureCount: number,
  targetsWanted: number,
  polarity: Polarity
): Figure[] {
  const slots = Array.from({ length: 20 }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  return Array.from({ length: figureCount }, (_, i) => {
    const slot = slots[i];
    const col = slot % 4;
    const row = Math.floor(slot / 4);
    let isTarget: boolean;
    let kind: { shape: Shape; color: StimColor };
    if (polarity === 'normal') {
      isTarget = i < targetsWanted;
      kind = isTarget ? rule : distractorFor(rule);
    } else {
      // negativa: los que COINCIDEN con la regla son los prohibidos
      const forbiddenCount = figureCount - targetsWanted;
      isTarget = i >= forbiddenCount;
      kind = isTarget ? distractorFor(rule) : rule;
    }
    return {
      id: i,
      shape: kind.shape,
      color: kind.color,
      isTarget,
      leftPct: 2 + col * 24 + Math.random() * 4,
      topPct: 2 + row * 19 + Math.random() * 3,
    };
  });
}

type Phase =
  | { kind: 'rule'; round: number }
  | { kind: 'play'; round: number }
  | { kind: 'roundEnd'; round: number; completed: boolean }
  | { kind: 'done' };

export function SelectiveAttentionGame({ gameId, level, onFinish }: GameProps) {
  const { figures: figureCount, targets: targetCount, size, roundMs } = config(level);

  // Reglas, polaridad y figuras de las 5 rondas, pregeneradas
  const [setup] = useState(() => {
    const polarity: Polarity =
      level >= 15 && Math.random() < 0.4 ? 'negative' : 'normal';
    const perRoundTargets =
      polarity === 'normal'
        ? targetCount
        : figureCount - Math.max(2, Math.round(figureCount * 0.4));
    const rule1 = randomRule();
    const rule2 = level >= 40 ? randomRule(rule1) : null;
    const rounds = Array.from({ length: ROUNDS }, (_, r) => {
      const rule = rule2 && r >= RULE_CHANGE_ROUND ? rule2 : rule1;
      return {
        rule,
        figures: makeRoundFigures(rule, figureCount, perRoundTargets, polarity),
      };
    });
    return { rule2, rounds, polarity, perRoundTargets };
  });

  // En la regla negativa hay más objetivos: más tiempo por ronda
  const effRoundMs =
    setup.polarity === 'negative' ? Math.round(roundMs * 1.5) : roundMs;

  const [phase, setPhase] = useState<Phase>({ kind: 'rule', round: 0 });
  const [remainingMs, setRemainingMs] = useState(effRoundMs);
  const [tapped, setTapped] = useState<Set<number>>(new Set());      // objetivos acertados
  const [wrongTapped, setWrongTapped] = useState<Set<number>>(new Set()); // distractores tocados

  const hitsRef = useRef(0);
  const falseAlarmsRef = useRef(0);
  const targetsTotalRef = useRef(0);
  const hitTimesRef = useRef<number[]>([]);
  const roundStartRef = useRef(0);
  const roundEndedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(Date.now());
  const finishedRef = useRef(false);

  const endRound = (round: number, completed: boolean) => {
    if (roundEndedRef.current) return;
    roundEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    targetsTotalRef.current += setup.perRoundTargets;
    setPhase({ kind: 'roundEnd', round, completed });
  };

  useEffect(() => {
    const clearAll = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (phase.kind === 'rule') {
      timerRef.current = setTimeout(() => {
        setTapped(new Set());
        setWrongTapped(new Set());
        roundEndedRef.current = false;
        roundStartRef.current = Date.now();
        setRemainingMs(effRoundMs);
        setPhase({ kind: 'play', round: phase.round });
      }, RULE_MS);
    } else if (phase.kind === 'play') {
      intervalRef.current = setInterval(() => {
        const left = effRoundMs - (Date.now() - roundStartRef.current);
        if (left <= 0) {
          endRound(phase.round, false);
        } else {
          setRemainingMs(left);
        }
      }, TICK_MS);
    } else if (phase.kind === 'roundEnd') {
      timerRef.current = setTimeout(() => {
        const next = phase.round + 1;
        if (next >= ROUNDS) {
          setPhase({ kind: 'done' });
        } else if (setup.rule2 && next === RULE_CHANGE_ROUND) {
          setPhase({ kind: 'rule', round: next });
        } else {
          setTapped(new Set());
          setWrongTapped(new Set());
          roundEndedRef.current = false;
          roundStartRef.current = Date.now();
          setRemainingMs(effRoundMs);
          setPhase({ kind: 'play', round: next });
        }
      }, ROUND_END_MS);
    } else if (phase.kind === 'done' && !finishedRef.current) {
      finishedRef.current = true;
      const decisions = targetsTotalRef.current + falseAlarmsRef.current;
      const accuracy = decisions
        ? Math.round((hitsRef.current / decisions) * 100)
        : 0;
      const rts = hitTimesRef.current;
      const speedBonus = rts.reduce(
        (acc, t) => acc + Math.max(0, Math.round((effRoundMs - t) / 100)),
        0
      );
      onFinish({
        gameId,
        level,
        score: Math.max(0, hitsRef.current * 100 - falseAlarmsRef.current * 50 + speedBonus),
        accuracy,
        avgReactionMs: rts.length
          ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length)
          : undefined,
        durationSeconds: Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        ),
      });
    }

    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleFigure = (f: Figure) => {
    if (phase.kind !== 'play') return;

    if (f.isTarget) {
      if (tapped.has(f.id)) return;
      const next = new Set(tapped);
      next.add(f.id);
      setTapped(next);
      hitsRef.current += 1;
      hitTimesRef.current.push(Date.now() - roundStartRef.current);
      if (next.size === setup.perRoundTargets) endRound(phase.round, true);
    } else {
      if (wrongTapped.has(f.id)) return;
      const next = new Set(wrongTapped);
      next.add(f.id);
      setWrongTapped(next);
      falseAlarmsRef.current += 1;
    }
  };

  if (phase.kind === 'rule') {
    const rule = setup.rounds[phase.round].rule;
    return (
      <View style={styles.container}>
        {phase.round > 0 && <Text style={styles.ruleChange}>¡CAMBIO DE REGLA!</Text>}
        <Text style={styles.ruleBig}>{ruleText(rule, setup.polarity)}</Text>
      </View>
    );
  }

  if (phase.kind === 'done') {
    return <View style={styles.container} />;
  }

  const roundData = setup.rounds[phase.round];
  if (!roundData) return <View style={styles.container} />; // guarda defensiva
  const { rule, figures } = roundData;
  const isEnd = phase.kind === 'roundEnd';

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Ronda {phase.round + 1} de {ROUNDS} · nivel {level}
      </Text>
      <View style={styles.headerRow}>
        <Text style={styles.rule}>{ruleText(rule, setup.polarity)}</Text>
        <Text style={[styles.timer, remainingMs <= 1500 && styles.timerUrgent]}>
          {isEnd
            ? phase.completed
              ? '¡Completado!'
              : 'Tiempo'
            : `${(remainingMs / 1000).toFixed(1)}s`}
        </Text>
      </View>
      <View style={styles.stage}>
        {figures.map((f) => {
          if (tapped.has(f.id)) return null; // acertadas desaparecen
          const missed = isEnd && f.isTarget; // al terminar, se marcan las que faltaron
          const wrong = wrongTapped.has(f.id);
          return (
            <Animated.View
              key={`r${phase.round}-f${f.id}`}
              entering={ZoomIn.delay(f.id * 30).duration(200)}
              exiting={ZoomOut.duration(150)}
              style={{
                position: 'absolute',
                top: `${f.topPct}%`,
                left: `${f.leftPct}%`,
                width: size,
                height: size,
              }}
            >
              <Pressable
                onPress={() => handleFigure(f)}
                style={{
                  flex: 1,
                  backgroundColor: COLOR_HEX[f.color],
                  borderRadius: f.shape === 'circle' ? size / 2 : Math.round(size / 8),
                  borderWidth: wrong || missed ? 3 : 0,
                  borderColor: wrong ? '#FFFFFF' : colors.danger,
                  opacity: wrong ? 0.45 : 1,
                  ...(f.shape === 'diamond'
                    ? { transform: [{ rotate: '45deg' }] }
                    : {}),
                }}
              />
            </Animated.View>
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
    justifyContent: 'flex-start',
    paddingTop: spacing.xl * 2,
    gap: spacing.sm,
  },
  progress: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  rule: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  timer: {
    color: colors.textMuted,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    minWidth: 50,
  },
  timerUrgent: {
    color: colors.danger,
    fontWeight: '700',
  },
  ruleBig: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl * 2,
  },
  ruleChange: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: spacing.xl * 2,
    marginBottom: -spacing.xl,
  },
  stage: {
    flex: 1,
    alignSelf: 'stretch',
    margin: spacing.md,
    position: 'relative',
  },
});
