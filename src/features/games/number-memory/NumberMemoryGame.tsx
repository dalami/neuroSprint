import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const ROUNDS = 3;
const FEEDBACK_MS = 1400;

/** Más dígitos y menos tiempo de exposición por dígito al subir de nivel */
function config(level: number) {
  const digits = Math.min(12, 3 + Math.floor((level - 1) / 5));
  const showMs = digits * Math.max(450, 800 - level * 4);
  return { digits, showMs };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeNumber(digits: number): string {
  let s = String(randInt(1, 9)); // el primero nunca es 0
  for (let i = 1; i < digits; i++) s += String(randInt(0, 9));
  return s;
}

const KEYPAD: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['⌫', '0', ''],
];

type Phase = 'show' | 'input' | 'feedback';

export function NumberMemoryGame({ gameId, level, onFinish }: GameProps) {
  const { digits, showMs } = config(level);

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('show');
  const [target, setTarget] = useState<string>(() => makeNumber(digits));
  const [entry, setEntry] = useState('');

  const hitsRef = useRef(0);       // dígitos correctos en la posición correcta
  const totalRef = useRef(0);      // dígitos totales evaluados
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (phase === 'show') {
      timerRef.current = setTimeout(() => setPhase('input'), showMs);
    } else if (phase === 'feedback') {
      timerRef.current = setTimeout(() => {
        const next = round + 1;
        if (next < ROUNDS) {
          setRound(next);
          setTarget(makeNumber(digits));
          setEntry('');
          setPhase('show');
        } else if (!finishedRef.current) {
          finishedRef.current = true;
          const accuracy = totalRef.current
            ? Math.round((hitsRef.current / totalRef.current) * 100)
            : 0;
          onFinish({
            gameId,
            level,
            score: hitsRef.current * 20,
            accuracy,
            durationSeconds: Math.max(
              1,
              Math.round((Date.now() - startedAtRef.current) / 1000)
            ),
          });
        }
      }, FEEDBACK_MS);
    }

    return clear;
  }, [phase, round, digits, showMs, gameId, level, onFinish]);

  const handleKey = (key: string) => {
    if (phase !== 'input' || key === '') return;

    if (key === '⌫') {
      setEntry((e) => e.slice(0, -1));
      return;
    }

    const nextEntry = entry + key;
    setEntry(nextEntry);

    // Al completar la cantidad de dígitos, se evalúa la ronda
    if (nextEntry.length === target.length) {
      let hits = 0;
      for (let i = 0; i < target.length; i++) {
        if (nextEntry[i] === target[i]) hits += 1;
      }
      hitsRef.current += hits;
      totalRef.current += target.length;
      setPhase('feedback');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Ronda {round + 1} de {ROUNDS} · nivel {level} · {digits} dígitos
      </Text>

      {phase === 'show' && (
        <>
          <Text style={styles.hint}>Memorizá</Text>
          <Text style={styles.number}>{target}</Text>
        </>
      )}

      {phase === 'input' && (
        <>
          <Text style={styles.hint}>Escribilo de memoria</Text>
          <Text style={styles.number}>
            {entry.padEnd(target.length, '·')}
          </Text>
          <View style={styles.keypad}>
            {KEYPAD.flat().map((key, i) => (
              <Pressable
                key={i}
                onPress={() => handleKey(key)}
                style={({ pressed }) => [
                  styles.key,
                  key === '' && styles.keyEmpty,
                  pressed && key !== '' && styles.keyPressed,
                ]}
              >
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {phase === 'feedback' && (
        <>
          <Text style={styles.hint}>Era</Text>
          <Text style={styles.number}>{target}</Text>
          <Text style={styles.hint}>Escribiste</Text>
          <Text style={styles.entryFeedback}>
            {entry.split('').map((ch, i) => (
              <Text
                key={i}
                style={{ color: ch === target[i] ? colors.success : colors.danger }}
              >
                {ch}
              </Text>
            ))}
          </Text>
        </>
      )}
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
    gap: spacing.md,
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
    letterSpacing: 1,
  },
  number: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 6,
  },
  entryFeedback: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 6,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  key: {
    width: 84,
    height: 60,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyPressed: {
    opacity: 0.7,
  },
  keyText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
  },
});
