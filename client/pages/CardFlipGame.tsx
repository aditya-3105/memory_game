import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Trophy, Timer, Zap } from "lucide-react";
import Layout from "@/components/Layout";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { mapSettingsToThreeLevel } from "@/lib/difficulty";
import { useAuth } from "@/contexts/AuthContext";
import { updateGameStats, logGamePlay } from "@/lib/user-stats";
import { playSound } from "@/lib/sound";

interface GameCard {
  id: number;
  value: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const cardSymbols = [
  "🎯",
  "🎮",
  "🎲",
  "🎪",
  "🎨",
  "🎭",
  "🎸",
  "🎺",
  "🎷",
  "🎻",
  "🎹",
  "🎼",
];

interface CardFlipGameProps {
  multiplayerMode?: boolean;
  onGameComplete?: (score: number) => void;
}

export default function CardFlipGame({
  multiplayerMode = false,
  onGameComplete,
}: CardFlipGameProps = {}) {
  const { settings } = useSettings();
  const { authState } = useAuth();
  const [cards, setCards] = useState<GameCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    multiplayerMode ? "easy" : "easy",
  );

  const gameGridRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const hasRecordedPlayRef = useRef(false);

  // Map settings difficulty on mount and when settings change (if game not started)
  useEffect(() => {
    const mapped = mapSettingsToThreeLevel(settings.difficulty);
    if (!gameStarted) {
      setDifficulty(mapped.level);
    }
  }, [settings.difficulty]);

  const difficultySettings = {
    easy: { pairs: 6, gridCols: "grid-cols-3", name: "Easy" },
    medium: { pairs: 8, gridCols: "grid-cols-4", name: "Medium" },
    hard: { pairs: 12, gridCols: "grid-cols-4", name: "Hard" },
  };

  const initializeGame = useCallback(() => {
    const pairs = difficultySettings[difficulty].pairs;
    const symbols = cardSymbols.slice(0, pairs);
    const gameCards = [...symbols, ...symbols]
      .map((symbol, index) => ({
        id: index,
        value: symbol,
        isFlipped: false,
        isMatched: false,
      }))
      .sort(() => Math.random() - 0.5);

    setCards(gameCards);
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setGameStarted(false);
    setGameCompleted(false);
    setTimeElapsed(0);
  }, [difficulty]);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Animate cards entrance when they're initialized
  useEffect(() => {
    if (cards.length > 0 && gameGridRef.current) {
      const gameCards = gameGridRef.current.querySelectorAll(".game-card");
      gameCards.forEach((card, index) => {
        const element = card as HTMLElement;
        element.style.animationDelay = `${500 + index * 100}ms`;
        element.classList.add("animate-fade-in-up");
      });
    }
  }, [cards.length, difficulty]);

  // Animate stats updates with CSS
  useEffect(() => {
    if (statsRef.current && gameStarted) {
      const statValues = statsRef.current.querySelectorAll(".stat-value");
      statValues.forEach((stat) => {
        const element = stat as HTMLElement;
        element.classList.remove("animate-pulse");
        setTimeout(() => element.classList.add("animate-pulse"), 10);
      });
    }
  }, [moves, matches, timeElapsed]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !gameCompleted) {
      interval = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameCompleted]);

  useEffect(() => {
    if (matches === difficultySettings[difficulty].pairs) {
      setGameCompleted(true);
    }
  }, [matches, difficulty]);

  useEffect(() => {
    if (gameCompleted) {
      const finalScore = getScore();

      if (multiplayerMode) {
        // In multiplayer mode, just report the score
        onGameComplete?.(finalScore);
      } else if (authState.isAuthenticated && authState.user) {
        // In single-player mode, update stats and log gameplay
        const streakCandidate = difficultySettings[difficulty].pairs;
        updateGameStats(authState.user.id, "card-flip", {
          addScore: finalScore,
          streakCandidate,
        }).catch(() => {});
        logGamePlay(authState.user.id, "card-flip", {
          score: finalScore,
          moves,
          timeElapsed,
          difficulty,
        }).catch(() => {});
      }
    }
    // Only run when game becomes completed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCompleted]);

  const handleCardClick = (cardId: number) => {
    if (!gameStarted) {
      setGameStarted(true);
      if (
        !hasRecordedPlayRef.current &&
        authState.isAuthenticated &&
        authState.user
      ) {
        hasRecordedPlayRef.current = true;
        updateGameStats(authState.user.id, "card-flip", {
          played: true,
        }).catch(() => {});
      }
    }

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched || flippedCards.length >= 2)
      return;

    // Animate card click with CSS
    const cardElement = document.querySelector(
      `[data-card-id="${cardId}"]`,
    ) as HTMLElement;
    if (cardElement) {
      cardElement.style.transform = "scale(0.95)";
      setTimeout(() => {
        cardElement.style.transform = "scale(1)";
      }, 100);
    }

    if (settings.soundEnabled) playSound("flip", settings.soundVolume / 100);
    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);

    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c)),
    );

    if (newFlippedCards.length === 2) {
      setMoves((prev) => prev + 1);

      const [firstId, secondId] = newFlippedCards;
      const firstCard = cards.find((c) => c.id === firstId);
      const secondCard = cards.find((c) => c.id === secondId);

      if (firstCard?.value === secondCard?.value) {
        // Match found - celebrate!
        setTimeout(() => {
          const matchedCards = [
            document.querySelector(
              `[data-card-id="${firstId}"]`,
            ) as HTMLElement,
            document.querySelector(
              `[data-card-id="${secondId}"]`,
            ) as HTMLElement,
          ];

          // Celebration animation with CSS
          matchedCards.forEach((card) => {
            if (card) {
              card.classList.add("animate-bounce");
              setTimeout(() => card.classList.remove("animate-bounce"), 600);
            }
          });

          setCards((prev) =>
            prev.map((c) =>
              c.id === firstId || c.id === secondId
                ? { ...c, isMatched: true }
                : c,
            ),
          );
          if (settings.soundEnabled)
            playSound("success", settings.soundVolume / 100);
          setMatches((prev) => prev + 1);
          setFlippedCards([]);
        }, 500);
      } else {
        // No match - shake animation
        if (settings.soundEnabled)
          playSound("error", settings.soundVolume / 100);
        setTimeout(() => {
          const wrongCards = [
            document.querySelector(
              `[data-card-id="${firstId}"]`,
            ) as HTMLElement,
            document.querySelector(
              `[data-card-id="${secondId}"]`,
            ) as HTMLElement,
          ];

          // Shake animation with CSS
          wrongCards.forEach((card) => {
            if (card) {
              card.classList.add("animate-pulse");
              card.style.animation = "shake 0.4s ease-out";
              setTimeout(() => {
                card.classList.remove("animate-pulse");
                card.style.animation = "";
              }, 400);
            }
          });

          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isFlipped: false }
                  : c,
              ),
            );
            setFlippedCards([]);
          }, 500);
        }, 1000);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScore = () => {
    const baseScore = difficultySettings[difficulty].pairs * 100;
    const timeBonus = Math.max(0, 300 - timeElapsed);
    const moveBonus = Math.max(
      0,
      (difficultySettings[difficulty].pairs * 2 - moves) * 10,
    );
    return baseScore + timeBonus + moveBonus;
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
          <h1 className="text-2xl font-bold text-foreground">
            Card Flip Memory
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={initializeGame}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            New Game
          </Button>
        </div>

        {/* Game Stats */}
        <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              <div>
                <p className="stat-value text-lg font-bold">
                  {formatTime(timeElapsed)}
                </p>
                <p className="text-xs text-muted-foreground">Time</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="stat-value text-lg font-bold">{moves}</p>
                <p className="text-xs text-muted-foreground">Moves</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="stat-value text-lg font-bold">
                  {matches}/{difficultySettings[difficulty].pairs}
                </p>
                <p className="text-xs text-muted-foreground">Matches</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Badge variant="secondary">
                {difficultySettings[difficulty].name}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Difficulty Selection */}
        {!gameStarted && (
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-center">Choose Difficulty</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center gap-4">
              {(
                Object.keys(difficultySettings) as Array<
                  keyof typeof difficultySettings
                >
              ).map((level) => (
                <Button
                  key={level}
                  variant={difficulty === level ? "default" : "outline"}
                  onClick={() => setDifficulty(level)}
                  className={cn(
                    "transition-all",
                    difficulty === level &&
                      "bg-primary text-primary-foreground",
                  )}
                >
                  {difficultySettings[level].name}
                  <Badge variant="secondary" className="ml-2">
                    {difficultySettings[level].pairs} pairs
                  </Badge>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Game Board */}
        <div
          ref={gameGridRef}
          className={cn(
            "grid gap-4 max-w-2xl mx-auto",
            difficultySettings[difficulty].gridCols,
          )}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              data-card-id={card.id}
              onClick={() => handleCardClick(card.id)}
              className={cn(
                "game-card relative aspect-square cursor-pointer transition-all duration-300 transform-gpu",
                "hover:scale-105",
                card.isMatched && "scale-90 opacity-75",
              )}
            >
              <div
                className={cn(
                  "w-full h-full rounded-lg transition-transform duration-500 transform-style-preserve-3d",
                  (card.isFlipped || card.isMatched) && "rotate-y-180",
                )}
              >
                {/* Front (Hidden) */}
                <div className="absolute inset-0 backface-hidden rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/30 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary/20 animate-pulse"></div>
                </div>

                {/* Back (Revealed) */}
                <div
                  className={cn(
                    "absolute inset-0 backface-hidden rotate-y-180 rounded-lg border-2 flex items-center justify-center text-6xl transition-colors",
                    card.isMatched
                      ? "bg-green-500/20 border-green-500/50 text-green-400"
                      : "bg-card border-border",
                  )}
                >
                  {card.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Game Completed Modal */}
        {gameCompleted && (
          <Card className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <CardContent className="bg-card border-2 border-primary/50 rounded-lg p-8 text-center space-y-6 max-w-md mx-4">
              <div className="text-6xl">🎉</div>
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  Congratulations!
                </h2>
                <p className="text-muted-foreground">You completed the game!</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatTime(timeElapsed)}
                  </p>
                  <p className="text-sm text-muted-foreground">Time</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{moves}</p>
                  <p className="text-sm text-muted-foreground">Moves</p>
                </div>
                <div className="col-span-2">
                  <p className="text-3xl font-bold text-primary">
                    {getScore()}
                  </p>
                  <p className="text-sm text-muted-foreground">Final Score</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={initializeGame} className="flex-1">
                  Play Again
                </Button>
                <Link to="/" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
