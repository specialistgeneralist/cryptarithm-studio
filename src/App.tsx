import { useEffect, useMemo, useState } from 'react';

type Difficulty = 1 | 2 | 3 | 4 | 5;

type Puzzle = {
  id: string;
  level: Difficulty;
  addends: string[];
  result: string;
  solution: Record<string, number>;
  sourceNumbers: number[];
};

type FeedbackKind = 'idle' | 'good' | 'warn' | 'bad';

type Feedback = {
  kind: FeedbackKind;
  text: string;
};

type SessionStats = {
  solved: number;
  streak: number;
  bestStreak: number;
  stars: number;
};

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const MAX_ATTEMPTS = 900;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample<T>(items: T[], count: number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function uniqueChars(words: string[]) {
  return [...new Set(words.join('').split(''))].sort();
}

function difficultyLabel(level: Difficulty) {
  return ['Warm-up', 'Starter', 'Steady', 'Stretch', 'Olympiad'][level - 1];
}

function difficultyParams(level: Difficulty) {
  if (level === 1) return { addends: [2], low: 10, high: 99, maxLetters: 4 };
  if (level === 2) return { addends: [2, 3], low: 10, high: 199, maxLetters: 5 };
  if (level === 3) return { addends: [2, 3], low: 50, high: 999, maxLetters: 6 };
  if (level === 4) return { addends: [2, 3], low: 100, high: 1999, maxLetters: 7 };
  return { addends: [3, 4], low: 100, high: 4999, maxLetters: 8 };
}

function encodeNumber(n: number, digitToLetter: Record<string, string>) {
  return String(n)
    .split('')
    .map((digit) => digitToLetter[digit])
    .join('');
}

function countSolutions(addends: string[], result: string, limit = 2) {
  const words = [...addends, result];
  const letters = uniqueChars(words);
  if (letters.length > 8) return { count: 0, solutions: [] as Record<string, number>[] };

  const leading = new Set(words.filter((word) => word.length > 1).map((word) => word[0]));
  const maxLen = Math.max(...words.map((word) => word.length));
  const assignment: Record<string, number> = {};
  const used = new Set<number>();
  const solutions: Record<string, number>[] = [];

  function recurseColumn(pos: number, carry: number) {
    if (solutions.length >= limit) return;
    if (pos >= maxLen) {
      if (carry === 0) solutions.push({ ...assignment });
      return;
    }

    const addLetters = addends
      .filter((word) => pos < word.length)
      .map((word) => word[word.length - 1 - pos]);
    const resultLetter = pos < result.length ? result[result.length - 1 - pos] : undefined;

    function assignAddend(index: number, total: number) {
      if (solutions.length >= limit) return;
      if (index === addLetters.length) {
        const digit = total % 10;
        const nextCarry = Math.floor(total / 10);

        if (!resultLetter) {
          if (digit === 0) recurseColumn(pos + 1, nextCarry);
          return;
        }

        if (assignment[resultLetter] !== undefined) {
          if (assignment[resultLetter] === digit) recurseColumn(pos + 1, nextCarry);
          return;
        }

        if (used.has(digit)) return;
        if (digit === 0 && leading.has(resultLetter)) return;
        assignment[resultLetter] = digit;
        used.add(digit);
        recurseColumn(pos + 1, nextCarry);
        used.delete(digit);
        delete assignment[resultLetter];
        return;
      }

      const letter = addLetters[index];
      if (assignment[letter] !== undefined) {
        assignAddend(index + 1, total + assignment[letter]);
        return;
      }

      for (let digit = 0; digit <= 9; digit += 1) {
        if (used.has(digit)) continue;
        if (digit === 0 && leading.has(letter)) continue;
        assignment[letter] = digit;
        used.add(digit);
        assignAddend(index + 1, total + digit);
        used.delete(digit);
        delete assignment[letter];
      }
    }

    assignAddend(0, carry);
  }

  recurseColumn(0, 0);
  return { count: solutions.length, solutions };
}

function makePuzzle(level: Difficulty): Puzzle {
  const params = difficultyParams(level);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const addendCount = params.addends[randomInt(0, params.addends.length - 1)];
    const numbers = Array.from({ length: addendCount }, () => randomInt(params.low, params.high));
    const total = numbers.reduce((sum, value) => sum + value, 0);
    const digits = [...new Set([...numbers, total].join('').split(''))].sort();

    if (digits.length < 4 || digits.length > params.maxLetters) continue;

    const letters = sample(LETTERS, digits.length);
    const digitToLetter: Record<string, string> = {};
    digits.forEach((digit, index) => {
      digitToLetter[digit] = letters[index];
    });

    const addends = numbers.map((n) => encodeNumber(n, digitToLetter));
    const result = encodeNumber(total, digitToLetter);
    const { count, solutions } = countSolutions(addends, result, 2);

    if (count === 1) {
      return {
        id: `${level}-${Date.now().toString(36)}-${attempt}`,
        level,
        addends,
        result,
        solution: solutions[0],
        sourceNumbers: numbers,
      };
    }
  }

  if (level > 1) return makePuzzle((level - 1) as Difficulty);
  throw new Error('Could not generate a unique puzzle. Please try again.');
}

function clampDifficulty(value: number): Difficulty {
  return Math.min(5, Math.max(1, value)) as Difficulty;
}

function wordValue(word: string, mapping: Record<string, string>) {
  const value = word
    .split('')
    .map((letter) => mapping[letter] ?? '')
    .join('');
  if (value.length !== word.length) return undefined;
  return Number(value);
}

function isNumber(value: number | undefined): value is number {
  return value !== undefined;
}

function rewardFor(puzzle: Puzzle, hintCount: number) {
  return Math.max(1, puzzle.level + 1 - Math.min(hintCount, 3));
}

function columnHint(puzzle: Puzzle, hintIndex: number) {
  const maxLen = Math.max(puzzle.result.length, ...puzzle.addends.map((word) => word.length));
  const col = Math.min(hintIndex % maxLen, maxLen - 1);
  const addLetters = puzzle.addends
    .filter((word) => col < word.length)
    .map((word) => word[word.length - 1 - col]);
  const resultLetter = col < puzzle.result.length ? puzzle.result[puzzle.result.length - 1 - col] : '0';

  let carryIn = 0;
  for (let c = 0; c < col; c += 1) {
    const total = puzzle.addends.reduce((sum, word) => {
      const letter = c < word.length ? word[word.length - 1 - c] : undefined;
      return sum + (letter ? puzzle.solution[letter] : 0);
    }, carryIn);
    carryIn = Math.floor(total / 10);
  }

  const total = addLetters.reduce((sum, letter) => sum + puzzle.solution[letter], carryIn);
  const carryOut = Math.floor(total / 10);
  const expression = addLetters.join(' + ');
  const place = col === 0 ? 'ones' : col === 1 ? 'tens' : col === 2 ? 'hundreds' : `column ${col + 1} from the right`;

  return `Look at the ${place}: ${expression}${carryIn ? ` + carry ${carryIn}` : ''} gives ${resultLetter} and carries ${carryOut}.`;
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function App() {
  const [level, setLevel] = useState<Difficulty>(2);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle', text: 'Fill each letter with a different digit.' });
  const [hints, setHints] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [solvedThisPuzzle, setSolvedThisPuzzle] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ solved: 0, streak: 0, bestStreak: 0, stars: 0 });

  const letters = useMemo(() => (puzzle ? uniqueChars([...puzzle.addends, puzzle.result]) : []), [puzzle]);
  const leadingLetters = useMemo(
    () => new Set(puzzle ? [...puzzle.addends, puzzle.result].filter((word) => word.length > 1).map((word) => word[0]) : []),
    [puzzle],
  );

  function newPuzzle(nextLevel = level) {
    setBuilding(true);
    setFeedback({ kind: 'idle', text: 'Building a fresh puzzle...' });
    window.setTimeout(() => {
      try {
        const created = makePuzzle(nextLevel);
        setLevel(created.level);
        setPuzzle(created);
        setEntries({});
        setHints([]);
        setSolvedThisPuzzle(false);
        setFeedback({ kind: 'idle', text: 'Start with the rightmost column and think about carries.' });
      } catch (error) {
        setFeedback({ kind: 'bad', text: error instanceof Error ? error.message : 'Something went wrong.' });
      } finally {
        setBuilding(false);
      }
    }, 20);
  }

  useEffect(() => {
    newPuzzle(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateEntry(letter: string, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    setEntries((current) => ({ ...current, [letter]: digit }));
    setFeedback({ kind: 'idle', text: 'Good. Keep checking columns from right to left.' });
  }

  function clearEntry(letter: string) {
    setEntries((current) => {
      const copy = { ...current };
      delete copy[letter];
      return copy;
    });
  }

  function checkAnswer() {
    if (!puzzle) return;

    const missing = letters.filter((letter) => !entries[letter]);
    if (missing.length > 0) {
      setFeedback({ kind: 'warn', text: `Still missing: ${missing.join(', ')}.` });
      return;
    }

    const used = new Map<string, string[]>();
    letters.forEach((letter) => {
      const digit = entries[letter];
      used.set(digit, [...(used.get(digit) ?? []), letter]);
    });
    const duplicate = [...used.entries()].find(([, mappedLetters]) => mappedLetters.length > 1);
    if (duplicate) {
      setFeedback({ kind: 'bad', text: `Digit ${duplicate[0]} is used by ${duplicate[1].join(' and ')}. Each letter needs its own digit.` });
      return;
    }

    const leadingZero = [...leadingLetters].find((letter) => entries[letter] === '0');
    if (leadingZero) {
      setFeedback({ kind: 'bad', text: `${leadingZero} cannot be 0 because it starts a number.` });
      return;
    }

    const addendValues = puzzle.addends.map((word) => wordValue(word, entries));
    const resultValue = wordValue(puzzle.result, entries);
    if (!addendValues.every(isNumber) || resultValue === undefined) {
      setFeedback({ kind: 'warn', text: 'Some entries are not complete yet. Fill every letter before checking.' });
      return;
    }

    const sum = addendValues.reduce((total, value) => total + value, 0);

    if (sum === resultValue) {
      const reward = rewardFor(puzzle, hints.length);
      if (!solvedThisPuzzle) {
        setStats((current) => {
          const nextStreak = current.streak + 1;
          return {
            solved: current.solved + 1,
            streak: nextStreak,
            bestStreak: Math.max(current.bestStreak, nextStreak),
            stars: current.stars + reward,
          };
        });
        setFeedback({ kind: 'good', text: `Correct! You earned ${reward} star${reward === 1 ? '' : 's'}.` });
      } else {
        setFeedback({ kind: 'good', text: 'Still correct. Choose your next example when you are ready.' });
      }
      setSolvedThisPuzzle(true);
    } else {
      setStats((current) => ({ ...current, streak: 0 }));
      setFeedback({ kind: 'bad', text: `${addendValues.join(' + ')} is ${sum}, not ${resultValue}. Find the first column where the carry breaks.` });
    }
  }

  function addHint() {
    if (!puzzle) return;
    const unsolved = letters.find((letter) => entries[letter] !== String(puzzle.solution[letter]));
    const nextHint = hints.length < 2
      ? columnHint(puzzle, hints.length)
      : unsolved
        ? `If you need a foothold: ${unsolved} = ${puzzle.solution[unsolved]}. Now re-check the nearby columns.`
        : 'Your digits match the hidden solution. Press “Check” to finish.';
    setHints((current) => [...current, nextHint]);
    setFeedback({ kind: 'idle', text: 'Hint added. Use it, then explain why it must be true.' });
  }

  function renderWord(word: string) {
    return (
      <div className="word" style={{ gridTemplateColumns: `repeat(${word.length}, minmax(2.1rem, 1fr))` }}>
        {word.split('').map((letter, index) => {
          const entered = entries[letter];
          return (
            <span className="letter-stack" key={`${word}-${index}-${letter}`}>
              <span className="letter">{letter}</span>
              <span className="digit-preview">{entered || '·'}</span>
            </span>
          );
        })}
      </div>
    );
  }

  if (!puzzle) {
    return <main className="app-shell loading-card">Preparing Cryptarithm Studio...</main>;
  }

  const filledCount = letters.filter((letter) => entries[letter]).length;
  const remainingCount = letters.length - filledCount;
  const readyToCheck = remainingCount === 0;
  const currentReward = rewardFor(puzzle, hints.length);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Junior Maths Olympiad practice</p>
          <h1>Cryptarithm Studio</h1>
          <p className="hero-copy">Train column reasoning, carries, and digit elimination with unique addition puzzles.</p>
        </div>
        <div className="score-card" aria-label="Session rewards">
          <div className="score-metrics">
            <span className="score-metric">
              <strong>⭐ {stats.stars}</strong>
              <small>Stars</small>
            </span>
            <span className="score-metric">
              <strong>{stats.solved}</strong>
              <small>Solved</small>
            </span>
            <span className="score-metric">
              <strong>🔥 {stats.streak}</strong>
              <small>Streak</small>
            </span>
          </div>
          <p className="reward-rules">Stars reset on refresh. Harder puzzles earn more; each hint lowers this puzzle’s stars, down to 1. A wrong check resets your streak.</p>
        </div>
      </section>

      <section className="studio-grid">
        <article className="panel puzzle-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{difficultyLabel(puzzle.level)} · Level {puzzle.level}</p>
              <h2>Puzzle</h2>
            </div>
            <div className={readyToCheck ? 'check-status ready' : 'check-status'} aria-live="polite">
              <span>{readyToCheck ? 'Ready to check' : 'Keep going'}</span>
              <small>{readyToCheck ? 'All letters have digits' : `${plural(remainingCount, 'letter')} left`}</small>
            </div>
          </div>

          <div className="equation" aria-label="Cryptarithm addition puzzle">
            {puzzle.addends.map((word, index) => (
              <div className="equation-row" key={`${puzzle.id}-${word}-${index}`}>
                <span className="operator">{index === puzzle.addends.length - 1 ? '+' : ''}</span>
                {renderWord(word)}
              </div>
            ))}
            <div className="equation-rule" />
            <div className="equation-row result-row">
              <span className="operator">=</span>
              {renderWord(puzzle.result)}
            </div>
          </div>

          <div className={`feedback ${feedback.kind}`} role="status">{feedback.text}</div>

          <div className="action-row">
            <button className="primary" onClick={checkAnswer} disabled={building}>Check</button>
            <button onClick={addHint} disabled={building || solvedThisPuzzle}>Hint</button>
            <button onClick={() => setEntries({})} disabled={building}>Clear</button>
            <div className="reward-preview" aria-live="polite">
              {solvedThisPuzzle ? (
                <>
                  <strong>Puzzle solved</strong>
                  <span>Choose your next example when ready.</span>
                </>
              ) : (
                <>
                  <strong>Solve now: ⭐ {currentReward}</strong>
                  <span>{hints.length === 0 ? 'Hints reduce stars.' : `${plural(hints.length, 'hint')} used.`}</span>
                </>
              )}
            </div>
          </div>

          {hints.length > 0 && (
            <div className="hints">
              <h3>Hints</h3>
              {hints.map((hint, index) => <p key={`${hint}-${index}`}>{hint}</p>)}
            </div>
          )}
        </article>

        <article className="panel keypad-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Digit map</p>
              <h2>Your substitutions</h2>
            </div>
          </div>

          <div className="letter-inputs">
            {letters.map((letter) => {
              const takenBy = letters.find((other) => other !== letter && entries[other] && entries[other] === entries[letter]);
              return (
                <label className={takenBy ? 'letter-input duplicate' : 'letter-input'} key={letter}>
                  <span>{letter}</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={entries[letter] ?? ''}
                    aria-label={`Digit for ${letter}`}
                    onChange={(event) => updateEntry(letter, event.target.value)}
                  />
                  <button className="mini" type="button" onClick={() => clearEntry(letter)} aria-label={`Clear ${letter}`}>×</button>
                </label>
              );
            })}
          </div>

          <div className="digit-chips" aria-label="Digits available">
            {DIGITS.map((digit) => {
              const owner = letters.find((letter) => entries[letter] === digit);
              return <span className={owner ? 'digit-chip used' : 'digit-chip'} key={digit}>{digit}{owner ? `=${owner}` : ''}</span>;
            })}
          </div>
        </article>
      </section>

      <section className="panel next-panel">
        <div>
          <p className="eyebrow">Next example</p>
          <h2>Choose the next challenge</h2>
          <p>Difficulty adjusts gently. There are no accounts or saved profiles; rewards are just for this session.</p>
        </div>
        <div className="next-buttons">
          <button onClick={() => newPuzzle(clampDifficulty(puzzle.level - 1))} disabled={building}>A bit easier</button>
          <button onClick={() => newPuzzle(puzzle.level)} disabled={building}>About the same</button>
          <button className="primary" onClick={() => newPuzzle(clampDifficulty(puzzle.level + 1))} disabled={building}>A bit harder</button>
        </div>
      </section>
    </main>
  );
}

export default App;
