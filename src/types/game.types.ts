export interface BlindTestTrack {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  ownerId: number;
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
  maxRounds?:number;
}
