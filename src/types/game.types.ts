export interface BlindTestTrack {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  ownerId: number;
}

export type GamePhase = "LOBBY" | "GUESS_SONG" | "GUESS_OWNER" | "SCOREBOARD";

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  tracks: BlindTestTrack[];
  currentTrack: number;
  scores: Record<number, number>;
}
