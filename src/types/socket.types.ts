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
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
  selectPlaylist: (playlistId: string) => void; // remplace l'ancien "playerReady" du front
  setMaxRounds: (maxRounds: number) => void; // réglage hôte, émis au changement 
  setGuessTime: (guessTime: number) => void; 
  startGame: () => void; // plus de {rounds, guessTime}: les réglages passent par les 2 events 
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
//Gestion des salons
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
  // roomUpdated est emis a chaque changement d'etat du salon
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

  // Erreurs
  error: (data: { message: string }) => void;

  // Lobby réglages
  settingsUpdated: (data: { maxRounds: number; guessTime: number }) => void; // remplace "maxRoundsSet"
  playerSelectedPlaylist: (data: { userId: number; playlistId: string }) => void;

  //Boucle de jeu
  gameStarted: (data: { totalTracks: number }) => void;
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
    imageUrl: string;
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