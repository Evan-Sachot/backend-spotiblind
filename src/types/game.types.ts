export interface BlindTestTrack {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  ownerIds: number[];
}

export type GamePhase = "LOBBY" | "GUESS_SONG" | "GUESS_OWNER" | "SCOREBOARD";

export interface GameState {
  roomHost: string;
  code: string;
  phase: GamePhase;
  tracks: BlindTestTrack[];
  playlists?: Record<number, string>;
  currentTrack: number;
  scores: Record<number, number>;
  maxRounds?: number;
  roundCorrectPlayers?: Record<number, boolean>; // Qui a trouvé la musique
  roundOwnerGuesses?: Record<number, number>; // Qui a voté pour quel propriétaire
}
