import { GameState, BlindTestTrack, PublicPlayer } from "../types/game.types.js";
import { TypedServer } from "../types/socket.types.js";
import userModel from "../models/user.model.js";
import spotifyService from "./spotify.service.js";
import itunesService from "./itunes.service.js";
import { isSameSong } from "../utils/text.util.js";

// CONSTANTE DE JEU
export const DEFAULT_MAX_ROUNDS = 10;
export const DEFAULT_GUESS_TIME = 30; 
export const OWNER_GUESS_TIME = 15; 
const NEXT_ROUND_DELAY = 5000; 
const CANDIDATE_FACTOR = 3;

// TRANSFORMATION : GameState -> PublicPlayer[]
const getPublicPlayers = (currentGame: GameState): PublicPlayer[] => {
  return Object.entries(currentGame.players).map(([idStr, info]) => ({
    id: Number(idStr),
    username: info.username,
    score: info.score,
  }));
};

// PREPARATION DES PISTES PHASE LOBBY => GUESS_SONG
const prepareTracks = async (
  playlists: Record<number, string>,
  maxRounds: number,
): Promise<BlindTestTrack[]> => {
  const trackPromises: Promise<BlindTestTrack[]>[] = [];
  for (const [userIdStr, playlistId] of Object.entries(playlists)) {
    const userId = Number(userIdStr);

    const tokens = await userModel.getSpotifyToken(userId);
    if (tokens) {
      const promise = spotifyService
        .getPlaylistTrack(userId, tokens.access_token, playlistId)
        .then((tracks) =>
          tracks.map((track) => ({
            ...track,
            ownerIds: [userId],
          })),
        );
      trackPromises.push(promise);
    }
  }

  const trackByPlaylist = await Promise.all(trackPromises);
  const allTracks = trackByPlaylist.flat();
  const trackMap: Record<string, BlindTestTrack> = {};
  for (const track of allTracks) {
    if (trackMap[track.id]) {
      const existingTrack = trackMap[track.id];
      if (!existingTrack.ownerIds.includes(track.ownerIds[0])) {
        existingTrack.ownerIds.push(track.ownerIds[0]);
      }
    } else {
      trackMap[track.id] = track;
    }
  }
  const uniqueTracks = Object.values(trackMap);
  for (let i = uniqueTracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
  }
  const candidates = uniqueTracks.slice(0, maxRounds * CANDIDATE_FACTOR);

  const resolvedTracks = await Promise.all(
    candidates.map(async (track) => {
      if (track.previewUrl) return track;
      // RECHERCHER URL D'EXTRAIT ITUNES
      const previewUrl = await itunesService.searchPreviewUrl(
        track.title,
        track.artist,
      );
      return previewUrl ? { ...track, previewUrl } : null;
    }),
  );

// FILTRER LES PISTES SANS EXTRAIT
  const playableTracks = resolvedTracks.filter(
    (track): track is BlindTestTrack => track !== null,
  );

  console.log(
    `Préparation : ${playableTracks.length} pistes jouables sur ${candidates.length} candidates (${uniqueTracks.length} au total)`,
  );

  return playableTracks.slice(0, maxRounds);
};

// LANCEMENT DE LA MANCHE
const startNewRound = (
  io: TypedServer,
  roomCode: string,
  currentGame: GameState,
  activeGames: Map<string, GameState>,
) => {
  currentGame.phase = "GUESS_SONG";

// MISE A ZERO DES SCORES DE MANCHE
  currentGame.roundCorrectPlayers = {};
  currentGame.roundOwnerGuesses = {};

  const nextTrack = currentGame.tracks[currentGame.currentTrack];
  const guessTime = currentGame.guessTime ?? DEFAULT_GUESS_TIME;

  io.to(roomCode).emit("newTrack", {
    previewUrl: nextTrack.previewUrl,
    currentRound: currentGame.currentTrack + 1, 
    totalRounds: currentGame.tracks.length,
    duration: guessTime, 
  });

  // CHRONO SERVEUR 
  setTimeout(() => {
    if (activeGames.has(roomCode) && currentGame.phase === "GUESS_SONG") {
      startOwnerGuessPhase(io, roomCode, currentGame, activeGames);
    }
  }, guessTime * 1000);
};

// PHASE DE VOTE
const startOwnerGuessPhase = (
  io: TypedServer,
  roomCode: string,
  currentGame: GameState,
  activeGames: Map<string, GameState>,
) => {
  currentGame.phase = "GUESS_OWNER";
  const currentTrack = currentGame.tracks[currentGame.currentTrack];

  io.to(roomCode).emit("songPhaseEnded", {
    title: currentTrack.title,
    artist: currentTrack.artist,
    imageUrl: currentTrack.imageUrl,
    duration: OWNER_GUESS_TIME,
  });

  setTimeout(() => {
    if (activeGames.has(roomCode) && currentGame.phase === "GUESS_OWNER") {
      endRoundAndNext(io, roomCode, currentGame, activeGames);
    }
  }, OWNER_GUESS_TIME * 1000);
};

// FIN DE MANCHE ET PASSAGE A LA SUIVANTE
const endRoundAndNext = (
  io: TypedServer,
  roomCode: string,
  currentGame: GameState,
  activeGames: Map<string, GameState>,
) => {
  const currentTrack = currentGame.tracks[currentGame.currentTrack];
  if (currentGame.roundOwnerGuesses) {
    for (const [playerIdStr, guessedOwnerId] of Object.entries(
      currentGame.roundOwnerGuesses,
    )) {
      const playerId = Number(playerIdStr);
      const player = currentGame.players[playerId];
      if (player && currentTrack.ownerIds.includes(guessedOwnerId)) {
        player.score += 5;
      }
    }
  }

  io.to(roomCode).emit("roundSummary", {
    ownerIds: currentTrack.ownerIds,
    players: getPublicPlayers(currentGame),
  });

  currentGame.currentTrack++;

  if (currentGame.currentTrack >= currentGame.tracks.length) {
    currentGame.phase = "SCOREBOARD";
    io.to(roomCode).emit("gameOver", { players: getPublicPlayers(currentGame) });
  } else {
    setTimeout(() => {
      if (activeGames.has(roomCode)) {
        startNewRound(io, roomCode, currentGame, activeGames);
      }
    }, NEXT_ROUND_DELAY);
  }
};

// LOGIQUE DE REPONSES
const processSongGuess = (
  currentGame: GameState,
  userId: number,
  guess: { trackId: string; title: string; artist: string },
): boolean => {
  const currentTrack = currentGame.tracks[currentGame.currentTrack];

  const isCorrect =
    guess.trackId === currentTrack.id ||
    isSameSong(guess, currentTrack);

  if (isCorrect) {
    if (!currentGame.roundCorrectPlayers) currentGame.roundCorrectPlayers = {};
    if (currentGame.roundCorrectPlayers[userId]) return false;

    currentGame.roundCorrectPlayers[userId] = true;

    const player = currentGame.players[userId];
    if (player) player.score += 10;
    return true;
  }
  return false;
};

const processOwnerGuess = (
  currentGame: GameState,
  userId: number,
  guessedOwnerId: number,
): boolean => {
  if (!currentGame.roundOwnerGuesses) currentGame.roundOwnerGuesses = {};
  currentGame.roundOwnerGuesses[userId] = guessedOwnerId;
  return true;
};

// RETOUR AU LOBBY
const resetGameToLobby = (currentGame: GameState) => {
  currentGame.phase = "LOBBY";
  currentGame.tracks = [];
  currentGame.currentTrack = 0;
  currentGame.playlists = {};
  for (const playerIdStr of Object.keys(currentGame.players)) {
    currentGame.players[Number(playerIdStr)].score = 0;
  }
};

export default {
  prepareTracks,
  startNewRound,
  processSongGuess,
  processOwnerGuess,
  resetGameToLobby,
  getPublicPlayers, 
};