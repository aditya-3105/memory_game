import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

export type GameId = "card-flip" | "guess-cup" | "simon-says" | "word-builder" | "picture-puzzle";

export interface Match {
  id: string;
  gameId: GameId;
  player1: {
    uid: string;
    username: string;
    score: number;
    completed: boolean;
  };
  player2: {
    uid: string;
    username: string;
    score: number;
    completed: boolean;
  } | null;
  gameState: Record<string, any>;
  status: "waiting" | "in-progress" | "completed";
  createdAt?: any;
  updatedAt?: any;
  winner?: string;
}

/**
 * Find or create a match for a player
 * Returns the match ID
 */
export async function findOrCreateMatch(
  uid: string,
  username: string,
  gameId: GameId,
): Promise<string> {
  try {
    // Look for a waiting match for this game
    const q = query(
      collection(db, "matches"),
      where("gameId", "==", gameId),
      where("status", "==", "waiting"),
      where("player1.uid", "!=", uid),
    );

    const snapshot = await getDocs(q);

    if (snapshot.size > 0) {
      // Found a waiting match, join it
      const matchDoc = snapshot.docs[0];
      const matchId = matchDoc.id;

      await updateDoc(doc(db, "matches", matchId), {
        player2: {
          uid,
          username,
          score: 0,
          completed: false,
        },
        status: "in-progress",
        updatedAt: serverTimestamp(),
      });

      return matchId;
    } else {
      // Create a new match
      const matchRef = await addDoc(collection(db, "matches"), {
        gameId,
        player1: {
          uid,
          username,
          score: 0,
          completed: false,
        },
        player2: null,
        gameState: {},
        status: "waiting",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return matchRef.id;
    }
  } catch (error) {
    console.error("Error in findOrCreateMatch:", error);
    throw error;
  }
}

/**
 * Subscribe to match updates
 */
export function subscribeToMatch(
  matchId: string,
  callback: (match: Match | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "matches", matchId),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as Match);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("Error subscribing to match:", error);
      callback(null);
    },
  );
}

/**
 * Update match game state
 */
export async function updateMatchState(
  matchId: string,
  gameState: Record<string, any>,
): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    gameState,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update player score and completion status
 */
export async function updatePlayerScore(
  matchId: string,
  playerNum: 1 | 2,
  score: number,
  completed: boolean = false,
): Promise<void> {
  const field = playerNum === 1 ? "player1" : "player2";
  const match = await getDoc(doc(db, "matches", matchId));
  
  if (!match.exists()) return;

  const data = match.data() as Match;
  const player = data[field as keyof Match];
  
  if (player) {
    await updateDoc(doc(db, "matches", matchId), {
      [field]: {
        ...player,
        score,
        completed,
      },
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Complete match and determine winner
 */
export async function completeMatch(matchId: string): Promise<void> {
  const match = await getDoc(doc(db, "matches", matchId));
  
  if (!match.exists()) return;

  const data = match.data() as Match;
  let winner: string | undefined;

  if (data.player1.score > (data.player2?.score || 0)) {
    winner = data.player1.uid;
  } else if ((data.player2?.score || 0) > data.player1.score) {
    winner = data.player2!.uid;
  }
  // else it's a tie, no winner

  await updateDoc(doc(db, "matches", matchId), {
    status: "completed",
    winner,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Cancel a match (e.g., if waiting too long)
 */
export async function cancelMatch(matchId: string): Promise<void> {
  await deleteDoc(doc(db, "matches", matchId));
}

/**
 * Get current match for a player
 */
export async function getCurrentMatch(
  uid: string,
): Promise<Match | null> {
  const q = query(
    collection(db, "matches"),
    where("status", "!=", "completed"),
  );

  const snapshot = await getDocs(q);

  for (const doc_ of snapshot.docs) {
    const match = doc_.data() as Match;
    if (match.player1.uid === uid || match.player2?.uid === uid) {
      return { ...match, id: doc_.id };
    }
  }

  return null;
}
