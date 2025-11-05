import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Shuffle } from "lucide-react";
import { motion, LayoutGroup } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { logGamePlay, updateGameStats } from "@/lib/user-stats";
import { playSound } from "@/lib/sound";

const IMAGES = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9?q=80&w=1200&auto=format&fit=crop",
];

function countInversions(arr: number[]): number {
  const a = arr.filter((v) => v !== -1);
  let inv = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (a[i] > a[j]) inv++;
    }
  }
  return inv;
}

function isSolvable(tiles: number[], size: number): boolean {
  const inv = countInversions(tiles);
  if (size % 2 === 1) {
    return inv % 2 === 0;
  } else {
    const emptyIndex = tiles.indexOf(-1);
    const emptyRowFromBottom = size - Math.floor(emptyIndex / size);
    if (emptyRowFromBottom % 2 === 0) {
      return inv % 2 === 1;
    } else {
      return inv % 2 === 0;
    }
  }
}

function makeSolvableShuffle(size: number): number[] {
  const total = size * size;
  const base = Array.from({ length: total - 1 }, (_, i) => i);
  base.push(-1);
  let tiles = [...base];
  const shuffle = (arr: number[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };
  do {
    tiles = [...base];
    shuffle(tiles);
  } while (
    !isSolvable(tiles, size) ||
    tiles.every((v, i) => (i < total - 1 ? v === i : v === -1))
  );
  return tiles;
}

interface PicturePuzzleGameProps {
  multiplayerMode?: boolean;
  onGameComplete?: (score: number) => void;
}

export default function PicturePuzzleGame({
  multiplayerMode = false,
  onGameComplete,
}: PicturePuzzleGameProps = {}) {
  const [grid, setGrid] = useState(3);
  const [tiles, setTiles] = useState<number[]>(() => makeSolvableShuffle(3));
  const [round, setRound] = useState(1);
  const [moves, setMoves] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [imageUrl, setImageUrl] = useState<string>(
    () => IMAGES[Math.floor(Math.random() * IMAGES.length)],
  );
  const { authState } = useAuth();
  const { settings } = useSettings();

  const isSolved = useMemo(() => {
    const total = grid * grid;
    for (let i = 0; i < total - 1; i++) if (tiles[i] !== i) return false;
    return tiles[total - 1] === -1;
  }, [tiles, grid]);

  useEffect(() => {
    if (isSolved) {
      const roundScore = Math.max(10, 200 - moves * 2);
      const newTotal = totalScore + roundScore;
      setTotalScore(newTotal);

      // update stats and advance round
      if (!multiplayerMode && authState.isAuthenticated && authState.user) {
        updateGameStats(authState.user.id, "picture-puzzle" as any, {
          played: true,
          addScore: roundScore,
          streakCandidate: round,
        }).catch(() => {});
        logGamePlay(authState.user.id, "picture-puzzle" as any, {
          round,
          grid,
          moves,
          imageUrl,
        }).catch(() => {});
      }

      if (settings.soundEnabled)
        playSound("success", settings.soundVolume / 100);

      // In multiplayer mode, end after 5 rounds
      if (multiplayerMode && round >= 5) {
        setTimeout(() => {
          onGameComplete?.(newTotal);
        }, 600);
        return;
      }

      const nextGrid = grid < 5 ? grid + 1 : grid; // grow to 5x5 max
      const nextRound = round + 1;
      setTimeout(() => {
        setRound(nextRound);
        setGrid(nextGrid);
        setTiles(makeSolvableShuffle(nextGrid));
        setMoves(0);
        setImageUrl(IMAGES[Math.floor(Math.random() * IMAGES.length)]);
      }, 600);
    }
  }, [isSolved]);

  const resetGame = () => {
    setRound(1);
    setGrid(3);
    setTiles(makeSolvableShuffle(3));
    setMoves(0);
    setImageUrl(IMAGES[Math.floor(Math.random() * IMAGES.length)]);
  };

  const shuffle = () => {
    setTiles(makeSolvableShuffle(grid));
    setMoves(0);
  };

  const handleClick = (idx: number) => {
    const empty = tiles.indexOf(-1);
    const er = Math.floor(empty / grid);
    const ec = empty % grid;
    const r = Math.floor(idx / grid);
    const c = idx % grid;
    const isNeighbor = Math.abs(er - r) + Math.abs(ec - c) === 1;
    if (!isNeighbor) return;
    setTiles((arr) => {
      const copy = [...arr];
      [copy[empty], copy[idx]] = [copy[idx], copy[empty]];
      return copy;
    });
    if (settings.soundEnabled) playSound("move", settings.soundVolume / 100);
    setMoves((m) => m + 1);
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
            Picture Puzzle{" "}
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

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Round</div>
              <div className="text-xl font-bold">{round}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Grid</div>
              <div className="text-xl font-bold">
                {grid}×{grid}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Moves</div>
              <div className="text-xl font-bold">{moves}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 md:col-span-3">
            <CardContent className="p-4 flex items-center gap-2">
              <Badge variant="secondary">Fluent transitions</Badge>
              <Badge variant="secondary">Random image each round</Badge>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Arrange the tiles</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={shuffle}
                className="gap-2"
              >
                <Shuffle className="h-4 w-4" /> Shuffle
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <LayoutGroup>
              <div className="flex flex-col md:flex-row items-start justify-center gap-6">
                <div
                  className="relative mx-auto"
                  style={{ width: 360, height: 360 }}
                >
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${grid}, 1fr)`,
                      gridTemplateRows: `repeat(${grid}, 1fr)`,
                      width: "100%",
                      height: "100%",
                      gap: 4,
                    }}
                  >
                    {tiles.map((tile, idx) => {
                      const percent = 100;
                      const bgX =
                        tile >= 0 ? (tile % grid) * (percent / (grid - 1)) : 0;
                      const bgY =
                        tile >= 0
                          ? Math.floor(tile / grid) * (percent / (grid - 1))
                          : 0;
                      const isEmpty = tile === -1;
                      return (
                        <motion.button
                          key={tile + "-" + idx}
                          layout
                          whileTap={!isEmpty ? { scale: 0.97 } : undefined}
                          onClick={() => handleClick(idx)}
                          className={`rounded-md border overflow-hidden focus:outline-none ${isEmpty ? "bg-black" : ""}`}
                          style={{
                            backgroundImage: isEmpty
                              ? undefined
                              : `url(${imageUrl})`,
                            backgroundSize: isEmpty
                              ? undefined
                              : `${grid * 100}% ${grid * 100}%`,
                            backgroundPosition: isEmpty
                              ? undefined
                              : `${bgX}% ${bgY}%`,
                            aspectRatio: "1 / 1",
                          }}
                          aria-label={isEmpty ? "Empty slot" : "Tile"}
                        />
                      );
                    })}
                  </div>
                </div>
                {/* Reference image */}
                <div className="md:self-center">
                  <div className="text-sm text-muted-foreground mb-2 text-center md:text-left">
                    Reference
                  </div>
                  <img
                    src={imageUrl}
                    alt="Reference"
                    className="w-40 h-40 object-cover rounded-md border bg-muted"
                  />
                </div>
              </div>
            </LayoutGroup>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
