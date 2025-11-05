import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Target,
  Zap,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import Layout from "@/components/Layout";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { updateGameStats, logGamePlay } from "@/lib/user-stats";

type GamePhase =
  | "setup"
  | "showing"
  | "waiting"
  | "correct"
  | "wrong"
  | "gameOver";
type ColorType = "red" | "blue" | "green" | "yellow";

interface ColorButton {
  id: ColorType;
  name: string;
  bgColor: string;
  activeColor: string;
  sound: number; // Frequency for beep
}

interface SimonSaysGameProps {
  multiplayerMode?: boolean;
  onGameComplete?: (score: number) => void;
}

export default function SimonSaysGame({
  multiplayerMode = false,
  onGameComplete,
}: SimonSaysGameProps = {}) {
  const { settings } = useSettings();
  const { authState } = useAuth();
  const [sequence, setSequence] = useState<ColorType[]>([]);
  const [playerSequence, setPlayerSequence] = useState<ColorType[]>([]);
  const [gamePhase, setGamePhase] = useState<GamePhase>("setup");
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [bestScore, setBestScore] = useState(0);
  const [activeColor, setActiveColor] = useState<ColorType | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speed, setSpeed] = useState(1000);

  const colors: ColorButton[] = [
    {
      id: "red",
      name: "Red",
      bgColor: "bg-red-500",
      activeColor: "bg-red-300",
      sound: 330,
    },
    {
      id: "blue",
      name: "Blue",
      bgColor: "bg-blue-500",
      activeColor: "bg-blue-300",
      sound: 262,
    },
    {
      id: "green",
      name: "Green",
      bgColor: "bg-green-500",
      activeColor: "bg-green-300",
      sound: 220,
    },
    {
      id: "yellow",
      name: "Yellow",
      bgColor: "bg-yellow-500",
      activeColor: "bg-yellow-300",
      sound: 392,
    },
  ];

  // Audio context for generating sounds
  const playSound = useCallback(
    (frequency: number, duration: number = 300) => {
      if (!soundEnabled) return;

      try {
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(
          frequency,
          audioContext.currentTime,
        );
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + duration / 1000,
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
      } catch (error) {
        console.log("Audio not supported");
      }
    },
    [soundEnabled],
  );

  const playErrorSound = useCallback(() => {
    if (!soundEnabled) return;
    playSound(150, 500); // Low error sound
  }, [soundEnabled, playSound]);

  const generateNewColor = useCallback(() => {
    const colorIds: ColorType[] = ["red", "blue", "green", "yellow"];
    return colorIds[Math.floor(Math.random() * colorIds.length)];
  }, []);

  const startGame = useCallback(() => {
    const newColor = generateNewColor();
    setSequence([newColor]);
    setPlayerSequence([]);
    setCurrentStep(0);
    setRound(1);
    setScore(0);
    setGamePhase("showing");
    showSequence([newColor]);
  }, [generateNewColor]);

  const showSequence = useCallback(
    (seq: ColorType[]) => {
      let index = 0;

      const showNext = () => {
        if (index >= seq.length) {
          setGamePhase("waiting");
          return;
        }

        const color = seq[index];
        const colorData = colors.find((c) => c.id === color)!;

        setActiveColor(color);
        playSound(colorData.sound, Math.max(200, speed - 100));

        setTimeout(
          () => {
            setActiveColor(null);
            index++;
            setTimeout(showNext, Math.max(100, speed - 300));
          },
          Math.max(300, speed),
        );
      };

      setTimeout(showNext, 500);
    },
    [colors, playSound, speed],
  );

  const handleColorClick = (colorId: ColorType) => {
    if (gamePhase !== "waiting") return;

    const colorData = colors.find((c) => c.id === colorId)!;
    playSound(colorData.sound, 200);

    const newPlayerSequence = [...playerSequence, colorId];
    setPlayerSequence(newPlayerSequence);

    // Check if current step is correct
    if (colorId !== sequence[playerSequence.length]) {
      // Wrong color
      setGamePhase("wrong");
      playErrorSound();
      setTimeout(() => {
        setGamePhase("gameOver");
        if (score > bestScore) {
          setBestScore(score);
        }

        if (multiplayerMode) {
          // In multiplayer mode, report the score and end the game
          onGameComplete?.(score);
        } else if (authState.isAuthenticated && authState.user) {
          const streakCandidate = Math.max(sequence.length - 1, 0);
          updateGameStats(authState.user.id, "simon-says", {
            played: true,
            addScore: score,
            streakCandidate,
          }).catch(() => {});
          logGamePlay(authState.user.id, "simon-says", {
            score,
            round,
            bestSequence: Math.max(sequence.length - 1, 0),
          }).catch(() => {});
        }
      }, 1000);
      return;
    }

    // Check if sequence is complete
    if (newPlayerSequence.length === sequence.length) {
      // Correct sequence completed
      setGamePhase("correct");
      const roundScore = sequence.length * 10 + round * 5;
      setScore((prev) => prev + roundScore);

      setTimeout(() => {
        // Add new color and continue
        const newColor = generateNewColor();
        const newSequence = [...sequence, newColor];
        setSequence(newSequence);
        setPlayerSequence([]);
        setRound((prev) => prev + 1);
        setSpeed((prev) => Math.max(300, prev - 50)); // Increase speed each round
        setGamePhase("showing");
        showSequence(newSequence);
      }, 1000);
    }
  };

  useEffect(() => {
    // Apply default speed from settings when in setup
    if (gamePhase === "setup") {
      if (settings.difficulty === "easy") setSpeed(1000);
      else if (settings.difficulty === "normal") setSpeed(800);
      else if (settings.difficulty === "hard") setSpeed(600);
      else setSpeed(900);
    }
  }, [settings.difficulty, gamePhase]);

  const resetGame = () => {
    setSequence([]);
    setPlayerSequence([]);
    setGamePhase("setup");
    setCurrentStep(0);
    setScore(0);
    setRound(1);
    if (settings.difficulty === "easy") setSpeed(1000);
    else if (settings.difficulty === "normal") setSpeed(800);
    else if (settings.difficulty === "hard") setSpeed(600);
    else setSpeed(900);
    setActiveColor(null);
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
          <h1 className="text-2xl font-bold text-foreground">Simon Says</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="gap-2"
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
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
                <p className="text-lg font-bold">{sequence.length}</p>
                <p className="text-xs text-muted-foreground">Sequence</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-2">
              <Badge variant="secondary">{bestScore} Best</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Game Instructions/Status */}
        {gamePhase === "setup" && (
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-center">
                Simon Says - Color Sequence
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Watch the sequence of colors flash, then repeat it by clicking
                the colors in the same order. Each round adds a new color to
                remember!
              </p>
              <Button onClick={startGame} className="gap-2">
                <Play className="h-4 w-4" />
                Start Game
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
                    👁️ Watch the sequence carefully!
                  </p>
                )}
                {gamePhase === "waiting" && (
                  <p className="text-lg font-semibold text-green-400">
                    🎯 Repeat the sequence by clicking the colors!
                  </p>
                )}
                {gamePhase === "correct" && (
                  <p className="text-lg font-semibold text-green-400">
                    ✅ Correct! Getting harder...
                  </p>
                )}
                {gamePhase === "wrong" && (
                  <p className="text-lg font-semibold text-red-400">
                    ❌ Wrong sequence!
                  </p>
                )}
                {gamePhase === "gameOver" && (
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-red-400">
                      🎮 Game Over!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Final Score: {score} | Best: {bestScore}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Color Grid */}
        <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
          {colors.map((color) => (
            <button
              key={color.id}
              onClick={() => handleColorClick(color.id)}
              disabled={gamePhase === "showing" || gamePhase === "setup"}
              className={cn(
                "aspect-square rounded-xl border-4 border-gray-600/50 transition-all duration-200 transform",
                "hover:scale-105 active:scale-95 disabled:cursor-not-allowed",
                "shadow-lg hover:shadow-xl",
                color.bgColor,
                activeColor === color.id
                  ? `${color.activeColor} scale-110 shadow-2xl`
                  : "",
                gamePhase === "wrong" && "animate-pulse",
                gamePhase === "waiting" &&
                  "hover:brightness-110 cursor-pointer",
                (gamePhase === "showing" || gamePhase === "setup") &&
                  "opacity-70",
              )}
            >
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white font-bold text-lg drop-shadow-lg">
                  {color.name}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Progress Indicator */}
        {gamePhase === "waiting" && (
          <Card className="bg-card/50 max-w-md mx-auto">
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Progress: {playerSequence.length} / {sequence.length}
                </p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(playerSequence.length / sequence.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game Over Actions */}
        {gamePhase === "gameOver" && (
          <div className="flex justify-center gap-4">
            <Button onClick={startGame} className="gap-2">
              <Play className="h-4 w-4" />
              Play Again
            </Button>
            <Link to="/">
              <Button variant="outline">Dashboard</Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
