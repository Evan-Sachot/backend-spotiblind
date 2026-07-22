// ============================================================
// CONTRAT SOCKET.IO — LA source de vérité unique front/back
// ------------------------------------------------------------
// Ce fichier doit être DUPLIQUÉ à l'identique côté front
// (src/types/socket.types.ts du projet React).
// Si un nom d'événement ou un payload change ici, TypeScript
// hurlera des deux côtés : c'est exactement le but.
// ============================================================
import { Socket, Server } from "socket.io";
import { GamePhase, PublicPlayer } from "./game.types.js";

// Le contenu du JWT décodé par le middleware d'authentification socket
export interface JwtUserPayload {
  id: number;
  username: string;
}

// Les données attachées à chaque socket après authentification
export interface CustomSocketData {
  user: JwtUserPayload;
}

// ------------------------------------------------------------
// CE QUE LE FRONT A LE DROIT D'ENVOYER AU SERVEUR
// ------------------------------------------------------------
export interface ClientToServerEvents {
  createRoom: () => void;
  joinRoom: (roomCode: string) => void; // ⚠️ une STRING nue, pas un objet
  leaveRoom: () => void;
  selectPlaylist: (playlistId: string) => void; // remplace l'ancien "playerReady" du front
  setMaxRounds: (maxRounds: number) => void; // réglage hôte, émis au changement du slider
  setGuessTime: (guessTime: number) => void; // réglage hôte, émis au changement du slider
  startGame: () => void; // ⚠️ plus de {rounds, guessTime} : les réglages passent par les 2 events ci-dessus
  // Le payload complet (et plus seulement l'ID) : la même chanson
  // existe sous plusieurs IDs Spotify (single/album/remaster), la
  // vérification se fait donc par titre+artiste normalisés côté serveur
  submitSongGuess: (guess: {
    trackId: string;
    title: string;
    artist: string;
  }) => void;
  submitOwnerGuess: (ownerId: number) => void; // ⚠️ un NUMBER nu, pas {ownerId}
  playAgain: () => void;
}

// ------------------------------------------------------------
// CE QUE LE SERVEUR A LE DROIT D'ENVOYER AU FRONT
// ------------------------------------------------------------
export interface ServerToClientEvents {
  // --- Salon ---
  // roomHost (username de l'hôte) est présent dans tous les payloads
  // de salon : le front en a besoin pour afficher la couronne et
  // savoir si le joueur courant est l'hôte
  roomCreated: (data: {
    roomCode: string;
    players: PublicPlayer[];
    roomHost: string;
  }) => void;
  roomJoined: (data: {
    roomCode: string;
    players: PublicPlayer[];
    roomHost: string;
  }) => void;
  // roomUpdated REMPLACE playerJoined / playerLeft / playerDisconnected :
  // un seul événement, le serveur renvoie la liste complète à chaque changement
  roomUpdated: (data: {
    players: PublicPlayer[];
    roomHost: string;
    message?: string;
  }) => void;
  roomClosed: (data: { message: string }) => void;
  roomRejoined: (data: {
    roomCode: string;
    phase: GamePhase;
    players: PublicPlayer[];
    roomHost: string;
  }) => void;

  // --- Erreurs : UN SEUL canal, UN SEUL format ---
  error: (data: { message: string }) => void;

  // --- Lobby / réglages ---
  settingsUpdated: (data: { maxRounds: number; guessTime: number }) => void; // remplace "maxRoundsSet"
  playerSelectedPlaylist: (data: { userId: number; playlistId: string }) => void;

  // --- Boucle de jeu ---
  gameStarted: (data: { totalTracks: number }) => void;
  // duration permet au front de faire son propre compte à rebours cosmétique
  // (le serveur reste l'arbitre : c'est SON setTimeout qui clôt la phase)
  newTrack: (data: {
    previewUrl: string;
    currentRound: number;
    totalRounds: number;
    duration: number;
  }) => void;
  playerFoundSong: (data: { userId: number; username: string }) => void;
  guessResult: (data: { correct: boolean }) => void;
  songPhaseEnded: (data: {
    title: string;
    artist: string;
    duration: number;
  }) => void;
  roundSummary: (data: { ownerIds: number[]; players: PublicPlayer[] }) => void; // ownerIds au PLURIEL (tableau)
  gameOver: (data: { players: PublicPlayer[] }) => void;
  gameReset: (data: { message: string }) => void;
}

// ------------------------------------------------------------
// ALIAS TYPÉS — à utiliser PARTOUT dans les handlers/services
// à la place de Server et Socket bruts : c'est ce typage qui
// rend toute faute de frappe impossible à compiler.
// ------------------------------------------------------------
export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>, // pas d'événements inter-serveurs
  CustomSocketData
>;

export type AuthenticateSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  CustomSocketData
>;