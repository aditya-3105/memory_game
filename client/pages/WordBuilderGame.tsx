import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";
import { mapSettingsToWordConfig } from "@/lib/difficulty";
import { WORD_LIST } from "@/data/word-list";
import {
  ArrowLeft,
  RotateCcw,
  Shuffle,
  Check,
  X,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { updateGameStats, logGamePlay } from "@/lib/user-stats";
import { playSound } from "@/lib/sound";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWord(min: number, max: number): string {
  const candidates = WORD_LIST.filter(
    (w) => w.length >= min && w.length <= max,
  );
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

function randomLetters(count: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return Array.from(
    { length: count },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  );
}

interface WordBuilderGameProps {
  multiplayerMode?: boolean;
  onGameComplete?: (score: number) => void;
}

export default function WordBuilderGame({
  multiplayerMode = false,
  onGameComplete,
}: WordBuilderGameProps = {}) {
  const { settings } = useSettings();
  const base = useMemo(
    () => mapSettingsToWordConfig(settings.difficulty),
    [settings.difficulty],
  );

  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const { authState } = useAuth();
  const [targetWord, setTargetWord] = useState("");
  const [letters, setLetters] = useState<string[]>([]);
  const [guess, setGuess] = useState("");
  const [message, setMessage] = useState<null | { ok: boolean; text: string }>(
    null,
  );
  const [usedIndices, setUsedIndices] = useState<number[]>([]);
  const [hintsLeft, setHintsLeft] = useState(1);

  const difficultyLabel = useMemo(() => {
    if (settings.difficulty === "normal") return "Normal";
    return (
      settings.difficulty.charAt(0).toUpperCase() + settings.difficulty.slice(1)
    );
  }, [settings.difficulty]);

  const buildRound = useCallback(
    (nextRound: number) => {
      const adaptOffset = base.adaptive ? Math.floor((nextRound - 1) / 3) : 0;
      // Start with easy words on round 1
      const minEasy = 3;
      const maxEasy = 5;
      const min =
        nextRound === 1 ? minEasy : Math.min(8, base.min + adaptOffset);
      const max =
        nextRound === 1 ? maxEasy : Math.min(8, base.max + adaptOffset);
      const extra = Math.min(
        6,
        base.extraLetters + Math.floor((nextRound - 1) / 2),
      );

      const word = pickWord(min, max);
      const pool = shuffleArray([...word.split(""), ...randomLetters(extra)]);

      setTargetWord(word);
      setLetters(pool);
      setGuess("");
      setUsedIndices([]);
      setMessage(null);
      setHintsLeft(1);
    },
    [base.min, base.max, base.extraLetters, base.adaptive],
  );

  useEffect(() => {
    buildRound(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.difficulty]);

  const handleChooseLetter = (index: number) => {
    if (usedIndices.includes(index)) return;
    setGuess((g) => g + letters[index]);
    setUsedIndices((u) => [...u, index]);
    if (settings.soundEnabled) playSound("click", settings.soundVolume / 100);
  };

  const handleBackspace = () => {
    if (guess.length === 0) return;
    const last = guess[guess.length - 1];
    // remove last used index matching the last char from the end
    for (let i = usedIndices.length - 1; i >= 0; i--) {
      if (letters[usedIndices[i]] === last) {
        const copy = [...usedIndices];
        copy.splice(i, 1);
        setUsedIndices(copy);
        break;
      }
    }
    setGuess((g) => g.slice(0, -1));
  };

  const checkAnswer = () => {
    const ok = guess.toLowerCase() === targetWord.toLowerCase();
    if (ok) {
      if (settings.soundEnabled)
        playSound("success", settings.soundVolume / 100);
      const gained = Math.max(
        10,
        targetWord.length * 10 + (letters.length - targetWord.length) * 2,
      );
      setScore((s) => s + gained);
      setStreak((v) => v + 1);
      setMessage({ ok: true, text: `Correct! +${gained} points` });
      if (authState.isAuthenticated && authState.user) {
        const nextStreak = streak + 1;
        updateGameStats(authState.user.id, "word-builder", {
          played: true,
          addScore: gained,
          streakCandidate: nextStreak,
        }).catch(() => {});
        logGamePlay(authState.user.id, "word-builder", {
          round,
          scoreGained: gained,
          wordLength: targetWord.length,
          extraLetters: letters.length - targetWord.length,
          nextStreak,
          word: targetWord,
        }).catch(() => {});
      }
      setTimeout(() => nextRound(), 1200);
    } else {
      setStreak(0);
      setMessage({ ok: false, text: "Try again!" });
      if (settings.soundEnabled) playSound("error", settings.soundVolume / 100);
    }
  };

  const shuffleLetters = () => {
    setLetters((l) => shuffleArray(l));
    setUsedIndices([]);
    setGuess("");
    if (settings.soundEnabled) playSound("move", settings.soundVolume / 100);
  };

  const useHint = () => {
    if (hintsLeft <= 0) return;
    // Reveal the next correct letter by appending it to the guess
    const nextIndex = guess.length;
    const needed = targetWord[nextIndex];
    if (!needed) return;
    // Find an unused letter index that matches needed
    const idx = letters.findIndex(
      (ch, i) =>
        !usedIndices.includes(i) && ch.toLowerCase() === needed.toLowerCase(),
    );
    if (idx >= 0) {
      setUsedIndices((u) => [...u, idx]);
      setGuess((g) => g + letters[idx]);
      setHintsLeft((h) => h - 1);
      setMessage({ ok: true, text: "Hint used: next letter revealed" });
      if (settings.soundEnabled) playSound("click", settings.soundVolume / 100);
    }
  };

  const nextRound = () => {
    const nr = round + 1;
    setRound(nr);
    buildRound(nr);
  };

  const resetGame = () => {
    setRound(1);
    setScore(0);
    setStreak(0);
    buildRound(1);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Word Builder</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={resetGame}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            New Game
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Round</div>
              <div className="text-xl font-bold">{round}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Score</div>
              <div className="text-xl font-bold">{score}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Badge variant="secondary">{difficultyLabel}</Badge>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
              <div className="text-xs text-muted-foreground">
                Unscramble the letters to form a valid word
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Letters */}
        <Card className="bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Choose Letters</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={useHint}
                disabled={hintsLeft <= 0}
                className="gap-2"
              >
                Hint ({hintsLeft})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto py-2">
              {letters.map((ch, idx) => {
                const used = usedIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => handleChooseLetter(idx)}
                    disabled={used}
                    className={cn(
                      "w-12 h-12 rounded-lg grid place-items-center text-lg font-semibold border transition-all transform-gpu",
                      "bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30",
                      "hover:scale-110 hover:shadow-lg hover:border-primary/60",
                      used && "opacity-40 scale-95",
                      "animate-fade-in-up",
                    )}
                    style={{ animationDelay: `${150 + idx * 60}ms` }}
                  >
                    {ch.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <Button
                variant="outline"
                className="gap-2"
                onClick={shuffleLetters}
              >
                <Shuffle className="h-4 w-4" /> Shuffle
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleBackspace}
                disabled={guess.length === 0}
              >
                <X className="h-4 w-4" /> Backspace
              </Button>
              <Button
                className="gap-2"
                onClick={checkAnswer}
                disabled={guess.length === 0}
              >
                <Check className="h-4 w-4" /> Submit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Guess */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-center">Your Guess</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <Input
                readOnly
                value={guess.toUpperCase()}
                className="text-center text-lg font-bold max-w-md"
              />
            </div>
            {message && (
              <div
                className={cn(
                  "text-center mt-3 font-medium",
                  message.ok ? "text-green-400" : "text-red-400",
                )}
              >
                {message.text}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
