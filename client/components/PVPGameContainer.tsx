import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader, Trophy, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { subscribeToMatch, updatePlayerScore, completeMatch, type Match } from "@/lib/matchmaking";
import { useAuth } from "@/contexts/AuthContext";
import CardFlipGame from "@/pages/CardFlipGame";
import GuessCupGame from "@/pages/GuessCupGame";
import SimonSaysGame from "@/pages/SimonSaysGame";
import WordBuilderGame from "@/pages/WordBuilderGame";
import PicturePuzzleGame from "@/pages/PicturePuzzleGame";

const gameComponents: Record<string, any> = {
  "card-flip": CardFlipGame,
  "guess-cup": GuessCupGame,
  "simon-says": SimonSaysGame,
  "word-builder": WordBuilderGame,
  "picture-puzzle": PicturePuzzleGame,
};

interface PVPGameProps {
  onGameComplete?: (score: number) => void;
}

export default function PVPGameContainer({ onGameComplete }: PVPGameProps) {
  const { gameId, matchId } = useParams();
  const navigate = useNavigate();
  const { authState } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerNum, setPlayerNum] = useState<1 | 2 | null>(null);
  const [opponentScore, setOpponentScore] = useState(0);
  const [gameCompleted, setGameCompleted] = useState(false);

  // Determine which player this user is and subscribe to match updates
  useEffect(() => {
    if (!matchId) return;

    const unsubscribe = subscribeToMatch(matchId, (matchData) => {
      if (!matchData) {
        setLoading(false);
        return;
      }

      setMatch(matchData);
      setLoading(false);

      if (authState.user) {
        if (matchData.player1.uid === authState.user.id) {
          setPlayerNum(1);
          if (matchData.player2) {
            setOpponentScore(matchData.player2.score);
          }
        } else if (matchData.player2?.uid === authState.user.id) {
          setPlayerNum(2);
          setOpponentScore(matchData.player1.score);
        }
      }
    });

    return () => unsubscribe();
  }, [matchId, authState.user?.id]);

  const handleGameComplete = async (score: number) => {
    if (!matchId || !playerNum) return;

    setGameCompleted(true);

    try {
      // Update this player's score
      await updatePlayerScore(matchId, playerNum, score, true);

      // Check if both players are done, then complete the match
      const checkAndComplete = setTimeout(async () => {
        if (match?.player1.uid && match?.player2?.uid) {
          await completeMatch(matchId);
        }
      }, 1000);

      onGameComplete?.(score);

      // Show results after a delay
      setTimeout(() => {
        navigate(`/pvp/results/${matchId}`);
      }, 3000);
    } catch (error) {
      console.error("Error completing game:", error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Loader className="h-12 w-12 text-primary animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading match...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!match || !gameId || !playerNum) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
          <Card className="bg-card/50 max-w-md">
            <CardHeader>
              <CardTitle>Match Not Found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The match could not be loaded. It may have expired.
              </p>
              <Button onClick={() => navigate("/pvp")} className="w-full">
                Back to PVP
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const GameComponent = gameComponents[gameId];
  const currentPlayer = playerNum === 1 ? match.player1 : match.player2;
  const opponent = playerNum === 1 ? match.player2 : match.player1;

  if (!GameComponent) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
          <Card className="bg-card/50 max-w-md">
            <CardHeader>
              <CardTitle>Game Not Found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The game could not be loaded.
              </p>
              <Button onClick={() => navigate("/pvp")} className="w-full">
                Back to PVP
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Match Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/pvp")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to PVP
          </Button>
          
          <div className="flex items-center gap-4">
            {/* Player 1 Score */}
            <Card className={currentPlayer === match.player1 ? "border-primary/50 bg-primary/10" : ""}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">
                  {match.player1.username}
                  {currentPlayer === match.player1 && (
                    <Badge variant="secondary" className="ml-2">
                      You
                    </Badge>
                  )}
                </div>
                <div className="text-lg font-bold text-primary">
                  {match.player1.score}
                </div>
              </CardContent>
            </Card>

            <div className="text-2xl font-bold text-muted-foreground">VS</div>

            {/* Player 2 Score */}
            <Card className={currentPlayer === match.player2 ? "border-primary/50 bg-primary/10" : ""}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">
                  {match.player2?.username || "Waiting..."}
                  {currentPlayer === match.player2 && (
                    <Badge variant="secondary" className="ml-2">
                      You
                    </Badge>
                  )}
                </div>
                <div className="text-lg font-bold text-primary">
                  {match.player2?.score || 0}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative">
          {!match.player2 && !gameCompleted && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-40 flex items-center justify-center rounded-lg">
              <div className="text-center space-y-2">
                <Loader className="h-8 w-8 text-primary animate-spin mx-auto" />
                <p className="text-muted-foreground">Waiting for opponent...</p>
              </div>
            </div>
          )}
          
          {gameCompleted && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-40 flex items-center justify-center rounded-lg">
              <div className="text-center space-y-3">
                <Trophy className="h-12 w-12 text-primary mx-auto" />
                <p className="font-semibold">Game Complete!</p>
                <p className="text-sm text-muted-foreground">Showing results...</p>
              </div>
            </div>
          )}

          <GameComponent multiplayerMode={true} onGameComplete={handleGameComplete} />
        </div>
      </div>
    </Layout>
  );
}
