import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Medal, Heart } from "lucide-react";
import Layout from "@/components/Layout";
import { subscribeToMatch, type Match } from "@/lib/matchmaking";
import { useAuth } from "@/contexts/AuthContext";

export default function PVPResults() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { authState } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerPosition, setPlayerPosition] = useState<
    "winner" | "loser" | "tie" | null
  >(null);

  useEffect(() => {
    if (!matchId) return;

    const unsubscribe = subscribeToMatch(matchId, (matchData) => {
      if (matchData) {
        setMatch(matchData);
        setLoading(false);

        if (authState.user) {
          if (matchData.winner === authState.user.id) {
            setPlayerPosition("winner");
          } else if (matchData.status === "completed" && !matchData.winner) {
            setPlayerPosition("tie");
          } else {
            setPlayerPosition("loser");
          }
        }
      }
    });

    return () => unsubscribe();
  }, [matchId, authState.user?.id]);

  if (loading || !match) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </Layout>
    );
  }

  const isWinner = playerPosition === "winner";
  const isTie = playerPosition === "tie";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Result Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {isWinner ? (
              <Crown className="h-16 w-16 text-yellow-400 animate-bounce" />
            ) : isTie ? (
              <Heart className="h-16 w-16 text-primary animate-pulse" />
            ) : (
              <Medal className="h-16 w-16 text-muted-foreground" />
            )}
          </div>

          <h1 className="text-4xl font-bold text-foreground">
            {isWinner ? "Victory!" : isTie ? "Draw!" : "Defeat"}
          </h1>

          <p className="text-xl text-muted-foreground">
            {isWinner
              ? "Congratulations! You won the match!"
              : isTie
                ? "Both players played equally well!"
                : "Great effort! Better luck next time."}
          </p>
        </div>

        {/* Match Details */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Match Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Player 1 */}
              <div
                className={`p-4 rounded-lg border-2 transition-all ${
                  match.winner === match.player1.uid
                    ? "border-yellow-400/50 bg-yellow-400/10"
                    : "border-border bg-background/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {match.player1.username}
                    </h3>
                    {match.winner === match.player1.uid && (
                      <Badge className="mt-1 bg-yellow-400/20 text-yellow-600 border-yellow-400/30">
                        Winner
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {match.player1.score}
                  </div>
                </div>
              </div>

              {/* Player 2 */}
              <div
                className={`p-4 rounded-lg border-2 transition-all ${
                  match.winner === match.player2?.uid
                    ? "border-yellow-400/50 bg-yellow-400/10"
                    : "border-border bg-background/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {match.player2?.username || "Opponent"}
                    </h3>
                    {match.winner === match.player2?.uid && (
                      <Badge className="mt-1 bg-yellow-400/20 text-yellow-600 border-yellow-400/30">
                        Winner
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {match.player2?.score || 0}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Difference */}
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Score Difference</p>
              <p className="text-3xl font-bold text-primary">
                {Math.abs(match.player1.score - (match.player2?.score || 0))}{" "}
                points
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/pvp")} className="gap-2">
            <Trophy className="h-4 w-4" />
            Play Again
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/leaderboard")}
            className="gap-2"
          >
            View Leaderboard
          </Button>
        </div>
      </div>
    </Layout>
  );
}
