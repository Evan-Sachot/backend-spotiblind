// ============================================================
// TYPES DU JEU — Source de vérité pour l'état d'une partie
// ============================================================

// Les 4 phases possibles d'un salon, dictées par le serveur
export type GamePhase = "LOBBY" | "GUESS_SONG" | "GUESS_OWNER" | "SCOREBOARD";

// Une piste du blindtest.
// ownerIds est un tableau : si 2 joueurs ont la même musique
// dans leur playlist, ils sont tous les deux "propriétaires".
export interface BlindTestTrack {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  previewUrl: string;
  ownerIds: number[];
}

// Les infos d'un joueur stockées côté serveur (dans GameState.players)
export interface PlayerInfo {
  username: string;
  score: number;
}

// La version "publique" d'un joueur, envoyée au front dans les payloads.
// On transforme le Record en tableau pour faciliter le .map() côté React.
export interface PublicPlayer {
  id: number;
  username: string;
  score: number;
  
}

// L'état complet d'un salon, stocké en mémoire dans la Map activeGames
export interface GameState {
  roomHost: string; // username de l'hôte (seul autorisé à lancer/relancer)
  code: string; // code du salon à 6 caractères
  phase: GamePhase;
  tracks: BlindTestTrack[]; // pistes de la partie (contient les réponses : NE JAMAIS envoyer au front tel quel)
  playlists?: Record<number, string>; // playlistId choisie par chaque joueur (userId -> playlistId), vidé au lancement
  currentTrack: number; // index de la piste en cours
  players: Record<number, PlayerInfo>; // userId -> { username, score } : REMPLACE l'ancien "scores"
  maxRounds?: number; // réglage hôte : nombre de manches (défaut géré dans game.service)
  guessTime?: number; // réglage hôte : durée en secondes de la phase GUESS_SONG (défaut 30)
  roundCorrectPlayers?: Record<number, boolean>; // qui a déjà trouvé la musique cette manche (anti double-points)
  roundOwnerGuesses?: Record<number, number>; // votes de la phase GUESS_OWNER (userId -> ownerId voté)
}