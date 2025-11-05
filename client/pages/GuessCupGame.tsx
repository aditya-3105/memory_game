import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Trophy, Target, Zap, Play } from "lucide-react";
import Layout from "@/components/Layout";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { updateGameStats, logGamePlay } from "@/lib/user-stats";
import { playSound } from "@/lib/sound";

interface Cup {
  id: number;
  hasBall: boolean;
  isLifted: boolean;
  position: number;
  visualPosition: number;
  isMoving: boolean;
}

type GamePhase = "setup" | "showing" | "shuffling" | "guessing" | "result";

interface GuessCupGameProps {
  multiplayerMode?: boolean;
  onGameComplete?: (score: number) => void;
}

export default function GuessCupGame({
  multiplayerMode = false,
  onGameComplete,
}: GuessCupGameProps = {}) {
  const { settings } = useSettings();
  const { authState } = useAuth();
  const [cups, setCups] = useState<Cup[]>([]);
  const [gamePhase, setGamePhase] = useState<GamePhase>("setup");
  const [ballPosition, setBallPosition] = useState(1);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [streak, setStreak] = useState(0);
  const [shuffleSpeed, setShuffleSpeed] = useState(1000);
  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState(false);
  const [cupCount, setCupCount] = useState(3);

  const initializeGame = useCallback(() => {
    const initialBallPos = Math.floor(Math.random() * cupCount);
    setBallPosition(initialBallPos);

    const newCups: Cup[] = Array.from({ length: cupCount }, (_, index) => ({
      id: index,
      hasBall: index === initialBallPos,
      isLifted: false,
      position: index,
      visualPosition: index,
      isMoving: false,
    }));

    setCups(newCups);
    setGamePhase("setup");
    setShowResult(false);
  }, [cupCount]);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  useEffect(() => {
    const diff = settings.difficulty;
    if (diff === "easy") {
      setCupCount(3);
      setShuffleSpeed(1000);
    } else if (diff === "normal") {
      setCupCount(4);
      setShuffleSpeed(800);
    } else if (diff === "hard") {
      setCupCount(5);
      setShuffleSpeed(600);
    } else {
      setCupCount(3);
      setShuffleSpeed(900);
    }
    initializeGame();
  }, [settings.difficulty]);

  const startGame = () => {
    setGamePhase("showing");

    // Show the ball for 3 seconds
    if (settings.soundEnabled) playSound("start", settings.soundVolume / 100);
    setCups((prev) => prev.map((cup) => ({ ...cup, isLifted: true })));

    setTimeout(() => {
      setCups((prev) => prev.map((cup) => ({ ...cup, isLifted: false })));
      setTimeout(() => {
        setGamePhase("shuffling");
        performShuffle();
      }, 1000); // Longer pause before shuffling
    }, 3000); // Show ball for longer
  };

  const performShuffle = () => {
    const shuffleCount = Math.min(4 + Math.floor(round / 2), 8);
    let shuffleIndex = 0;
    let currentBallPosition = ballPosition;

    const shuffle = () => {
      const stepDuration = Math.max(300, shuffleSpeed - (round - 1) * 40);
      if (shuffleIndex >= shuffleCount) {
        setBallPosition(currentBallPosition);
        setGamePhase("guessing");
        return;
      }

      // Pick two adjacent positions to swap
      const pos1 = Math.floor(Math.random() * (cupCount - 1));
      const pos2 = pos1 + 1;

      // Start the swap animation by marking cups as moving (no lifting to keep ball hidden)
      setCups((prev) => {
        const newCups = [...prev];
        // Find cups at the positions we want to swap
        const cup1Index = newCups.findIndex(
          (cup) => cup.visualPosition === pos1,
        );
        const cup2Index = newCups.findIndex(
          (cup) => cup.visualPosition === pos2,
        );

        // Mark them as moving and swap their visual positions
        newCups[cup1Index].isMoving = true;
        newCups[cup2Index].isMoving = true;
        newCups[cup1Index].visualPosition = pos2;
        newCups[cup2Index].visualPosition = pos1;

        return newCups;
      });

      // Update ball position tracking
      if (currentBallPosition === pos1) {
        currentBallPosition = pos2;
      } else if (currentBallPosition === pos2) {
        currentBallPosition = pos1;
      }

      // After swap animation completes, reset moving state
      setTimeout(() => {
        setCups((prev) =>
          prev.map((cup) => ({
            ...cup,
            isMoving: false,
            hasBall: cup.visualPosition === currentBallPosition,
          })),
        );

        shuffleIndex++;
        setTimeout(shuffle, Math.max(200, stepDuration - 100)); // Pause between shuffles
      }, stepDuration); // Time for position swap animation
    };

    shuffle();
  };

  const handleCupClick = (cupIndex: number) => {
    if (gamePhase !== "guessing") return;

    // Find which cup is currently at this visual position
    const clickedCup = cups.find((cup) => cup.visualPosition === cupIndex);
    const isCorrect = clickedCup?.hasBall || false;

    setLastGuessCorrect(isCorrect);
    if (settings.soundEnabled)
      playSound(isCorrect ? "success" : "error", settings.soundVolume / 100);
    setShowResult(true);

    // Lift all cups to show result
    setCups((prev) => prev.map((cup) => ({ ...cup, isLifted: true })));
    setGamePhase("result");

    const nextStreak = isCorrect ? streak + 1 : 0;
    const roundScore = isCorrect ? 100 + streak * 20 : 0;
    if (isCorrect) {
      setScore((prev) => prev + roundScore);
      setStreak((prev) => prev + 1);
    } else {
      setStreak(0);
    }
    if (authState.isAuthenticated && authState.user) {
      updateGameStats(authState.user.id, "guess-cup", {
        played: true,
        addScore: roundScore,
        streakCandidate: nextStreak,
      }).catch(() => {});
      logGamePlay(authState.user.id, "guess-cup", {
        round,
        gained: roundScore,
        totalScoreAfter: isCorrect ? score + roundScore : score,
        streakAfter: nextStreak,
        correct: isCorrect,
        cupCount,
      }).catch(() => {});
    }

    setTimeout(() => {
      nextRound();
    }, 3000);
  };

  const nextRound = () => {
    const nextRoundNum = round + 1;

    // In multiplayer mode, end game after 5 rounds
    if (multiplayerMode && nextRoundNum > 5) {
      onGameComplete?.(score);
      return;
    }

    setRound(nextRoundNum);
    setShuffleSpeed((prev) => Math.max(300, prev - 50)); // Increase speed each round
    if (nextRoundNum % 3 === 0 && cupCount < 5) {
      setCupCount((prev) => prev + 1); // Add a cup every 3 rounds
    }
    initializeGame();
  };

  const resetGame = () => {
    setScore(0);
    setRound(1);
    setStreak(0);
    setShuffleSpeed(1000);
    setCupCount(3);
    initializeGame();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to={multiplayerMode ? "/pvp" : "/"}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back {multiplayerMode ? "to PVP" : "to Dashboard"}
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            Guess the Cup{" "}
            {multiplayerMode && (
              <span className="text-sm text-primary">(PVP)</span>
            )}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={resetGame}
            className="gap-2"
            disabled={multiplayerMode}
          >
            <RotateCcw className="h-4 w-4" />
            New Game
          </Button>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{score}</p>
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{round}</p>
                <p className="text-xs text-muted-foreground">Round</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{streak}</p>
                <p className="text-xs text-muted-foreground">Streak</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Badge variant="secondary">{cupCount} Cups</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Game Instructions */}
        {gamePhase === "setup" && (
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-center">Watch the Ball!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Watch carefully as the ball is placed under a cup. The cups will
                then shuffle around. Can you track which cup has the ball?
              </p>
              <Button onClick={startGame} className="gap-2">
                <Play className="h-4 w-4" />
                Start Round {round}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Game Phase Indicator */}
        {gamePhase !== "setup" && (
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-center">
                {gamePhase === "showing" && (
                  <p className="text-lg font-semibold text-primary">
                    👀 Remember where the ball is!
                  </p>
                )}
                {gamePhase === "shuffling" && (
                  <p className="text-lg font-semibold text-orange-400">
                    🔄 Cups are shuffling...
                  </p>
                )}
                {gamePhase === "guessing" && (
                  <p className="text-lg font-semibold text-green-400">
                    🎯 Click the cup with the ball!
                  </p>
                )}
                {gamePhase === "result" && showResult && (
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      lastGuessCorrect ? "text-green-400" : "text-red-400",
                    )}
                  >
                    {lastGuessCorrect ? "🎉 Correct!" : "❌ Wrong!"}
                    {lastGuessCorrect && streak > 1 && ` ${streak} in a row!`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game Board */}
        <div className="flex justify-center items-end space-x-8 py-12">
          {cups.map((cup, index) => (
            <div
              key={cup.id}
              onClick={() => handleCupClick(cup.visualPosition)}
              className={cn(
                "relative cursor-pointer group transition-all duration-400 transform",
                gamePhase === "guessing" && "hover:scale-105",
                gamePhase !== "guessing" && "cursor-default",
              )}
              style={{
                transform: `translateX(${(cup.visualPosition - cup.position) * 112}px)`,
                transition:
                  gamePhase === "shuffling" && cup.isMoving
                    ? `transform ${Math.max(300, shuffleSpeed - (round - 1) * 40)}ms cubic-bezier(0.4, 0, 0.2, 1)`
                    : "transform 300ms ease",
              }}
            >
              {/* Ball */}
              <div
                className={cn(
                  "absolute bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full transition-all duration-300",
                  "bg-gradient-to-br from-red-400 to-red-600 shadow-lg",
                  cup.hasBall ? "opacity-100" : "opacity-0",
                  cup.isLifted ? "z-10" : "z-0",
                )}
              />

              {/* Cup */}
              <div
                className={cn(
                  "w-20 h-24 relative transition-all duration-500 transform-gpu",
                  cup.isLifted && "-translate-y-8",
                )}
              >
                {/* Cup Body */}
                <div
                  className={cn(
                    "w-full h-full rounded-t-lg transition-all duration-300",
                    "bg-gradient-to-b from-orange-400 to-orange-600",
                    "border-2 border-orange-500/50",
                    "shadow-lg shadow-orange-900/20",
                    gamePhase === "guessing" &&
                      "group-hover:from-orange-300 group-hover:to-orange-500",
                    gamePhase === "shuffling" &&
                      "shadow-2xl shadow-orange-900/60 scale-105",
                  )}
                >
                  {/* Cup Highlight */}
                  <div className="w-4 h-8 bg-orange-200/30 rounded-full absolute top-2 left-2" />
                  {/* Cup Number for easier tracking during shuffle */}
                  {gamePhase === "shuffling" && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center text-xs font-bold text-orange-800">
                      {cup.visualPosition + 1}
                    </div>
                  )}
                </div>

                {/* Cup Base */}
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-24 h-2 bg-orange-700 rounded-full opacity-50" />
              </div>
            </div>
          ))}
        </div>

        {/* Game Table */}
        <div className="h-4 bg-gradient-to-r from-amber-900/20 via-amber-800/30 to-amber-900/20 rounded-lg mx-auto max-w-2xl" />
      </div>
    </Layout>
  );
}
