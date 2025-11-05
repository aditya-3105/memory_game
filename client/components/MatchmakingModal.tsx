import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader, X } from "lucide-react";
import { subscribeToMatch, cancelMatch, type GameId } from "@/lib/matchmaking";
import { useAuth } from "@/contexts/AuthContext";

interface MatchmakingModalProps {
  isOpen: boolean;
  gameId: GameId;
  onMatchFound?: (matchId: string) => void;
  onCancel?: () => void;
}

export default function MatchmakingModal({
  isOpen,
  gameId,
  onMatchFound,
  onCancel,
}: MatchmakingModalProps) {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!matchId) return;

    const unsubscribe = subscribeToMatch(matchId, (match) => {
      if (!match) return;

      // Check if both players are present
      if (match.player2 && match.status === "in-progress") {
        setOpponent(match.player2.username);

        // Auto-navigate after a short delay to show the opponent found message
        const timeout = setTimeout(() => {
          if (onMatchFound) {
            onMatchFound(matchId);
          } else {
            navigate(`/pvp/game/${gameId}/${matchId}`);
          }
        }, 1500);

        return () => clearTimeout(timeout);
      }
    });

    return () => unsubscribe();
  }, [matchId, gameId, navigate, onMatchFound]);

  useEffect(() => {
    if (!isOpen || !matchId) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);

      // Auto-cancel after 60 seconds of waiting
      if (elapsedTime >= 60) {
        handleCancel();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, matchId, elapsedTime]);

  const handleCancel = async () => {
    if (matchId) {
      try {
        await cancelMatch(matchId);
      } catch (error) {
        console.error("Error canceling match:", error);
      }
    }
    setMatchId(null);
    setOpponent(null);
    setElapsedTime(0);
    onCancel?.();
  };

  const formatTime = (seconds: number) => {
    return `${seconds}s`;
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center">
            {opponent ? "Opponent Found!" : "Finding Match..."}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="text-center space-y-4 py-4">
          {opponent ? (
            <>
              <p className="text-lg font-semibold text-foreground">
                Playing against:{" "}
                <span className="text-primary">{opponent}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Get ready to compete!
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center py-4">
                <Loader className="h-8 w-8 text-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">
                Searching for an opponent...
              </p>
              <p className="text-xs text-muted-foreground">
                Waiting: {formatTime(elapsedTime)}
              </p>
            </>
          )}
        </div>

        <div className="flex gap-2 justify-center">
          {!opponent && (
            <AlertDialogCancel onClick={handleCancel} className="gap-2">
              <X className="h-4 w-4" />
              Cancel
            </AlertDialogCancel>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
