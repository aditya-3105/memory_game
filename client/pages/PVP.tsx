import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Trophy,
  Brain,
  Palette,
  Type,
  Image as ImageIcon,
} from "lucide-react";
import Layout from "@/components/Layout";
import MatchmakingModal from "@/components/MatchmakingModal";
import { useAuth } from "@/contexts/AuthContext";
import { findOrCreateMatch, type GameId } from "@/lib/matchmaking";
import { cn } from "@/lib/utils";

const games = [
  {
    id: "card-flip" as GameId,
    title: "Card Flip Memory",
    description:
      "Match pairs of cards by flipping them over. Test your memory against another player.",
    icon: Layers,
    difficulty: "Easy",
    color: "from-purple-600/20 to-purple-800/20",
    borderColor: "border-purple-500/30",
  },
  {
    id: "guess-cup" as GameId,
    title: "Guess the Cup",
    description:
      "Track the ball under a cup while your opponent tries to distract you. Can you find the ball?",
    icon: Trophy,
    difficulty: "Medium",
    color: "from-orange-600/20 to-orange-800/20",
    borderColor: "border-orange-500/30",
  },
  {
    id: "simon-says" as GameId,
    title: "Simon Says",
    description:
      "Watch the color sequence and repeat it perfectly. First to fail loses!",
    icon: Palette,
    difficulty: "Hard",
    color: "from-blue-600/20 to-indigo-800/20",
    borderColor: "border-blue-500/30",
  },
  {
    id: "word-builder" as GameId,
    title: "Word Builder",
    description:
      "Unscramble letters to form a word faster than your opponent. Speed matters!",
    icon: Type,
    difficulty: "Adaptive",
    color: "from-emerald-600/20 to-teal-800/20",
    borderColor: "border-emerald-500/30",
  },
  {
    id: "picture-puzzle" as GameId,
    title: "Picture Puzzle",
    description:
      "Race to arrange shuffled image tiles before your opponent does. 3×3 tiles.",
    icon: ImageIcon,
    difficulty: "Easy",
    color: "from-pink-600/20 to-rose-800/20",
    borderColor: "border-pink-500/30",
  },
];

export default function PVP() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handlePlayGame = async (gameId: GameId) => {
    if (!authState.isAuthenticated || !authState.user) {
      // Show login modal would go here, for now just alert
      alert("Please sign in to play PVP games");
      return;
    }

    setSelectedGame(gameId);
    setShowMatchmaking(true);
    setIsSearching(true);

    try {
      await findOrCreateMatch(
        authState.user.id,
        authState.user.username,
        gameId,
      );
    } catch (error) {
      console.error("Error finding match:", error);
      alert("Failed to find match. Please try again.");
      setShowMatchmaking(false);
      setIsSearching(false);
    }
  };

  const handleMatchFound = (matchId: string) => {
    setShowMatchmaking(false);
    setIsSearching(false);
    navigate(`/pvp/game/${selectedGame}/${matchId}`);
  };

  const handleCancelMatchmaking = () => {
    setShowMatchmaking(false);
    setIsSearching(false);
    setSelectedGame(null);
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            PVP Games
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Challenge other players and compete for the top spot. Find an
            opponent and test your skills in real-time battles.
          </p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {games.map((game) => {
            const Icon = game.icon;
            return (
              <Card
                key={game.id}
                className={`group cursor-pointer overflow-hidden bg-gradient-to-br ${game.color} border-2 ${game.borderColor} transition-all duration-700 hover:scale-105 hover:-translate-y-3 hover:shadow-2xl hover:shadow-primary/30 hover:border-primary/50 transform-gpu`}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="game-icon p-3 rounded-lg bg-primary/20 group-hover:bg-primary/30 transition-all duration-500 group-hover:rotate-12 group-hover:scale-125 animate-pulse-slow">
                      <Icon className="h-8 w-8 text-primary group-hover:text-primary-foreground transition-colors" />
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-secondary/80 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110"
                    >
                      {game.difficulty}
                    </Badge>
                  </div>
                  <div className="transform transition-transform duration-300 group-hover:translate-x-1">
                    <CardTitle className="text-xl text-foreground group-hover:text-primary transition-colors duration-300">
                      {game.title}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground mt-2 group-hover:text-foreground transition-colors">
                      {game.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={() => handlePlayGame(game.id)}
                    disabled={isSearching}
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg transform-gpu"
                  >
                    <span className="group-hover:animate-pulse">
                      Find Opponent
                    </span>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="max-w-2xl mx-auto bg-card/50 border border-border rounded-lg p-6 space-y-3">
          <h3 className="font-semibold text-foreground">How PVP Works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Click "Find Opponent" to start searching for a match</li>
            <li>• Wait for another player to join your game</li>
            <li>• Once paired, you'll compete in real-time</li>
            <li>• First to complete the challenge or highest score wins</li>
            <li>• Results are recorded on the leaderboard</li>
          </ul>
        </div>
      </div>

      {/* Matchmaking Modal */}
      <MatchmakingModal
        isOpen={showMatchmaking}
        gameId={selectedGame || "card-flip"}
        onMatchFound={handleMatchFound}
        onCancel={handleCancelMatchmaking}
      />
    </Layout>
  );
}
