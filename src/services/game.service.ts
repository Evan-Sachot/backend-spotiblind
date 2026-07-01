import { Server } from "socket.io";
import { GameState, BlindTestTrack } from "../types/game.types.js";
import userModel from "../models/user.model.js";
import spotifyService from "./spotify.service.js";

const prepareTracks = async (
  playlists: Record<number, string>,
  maxRounds?: number,
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
            ownerId: userId,
          })),
        );
      trackPromises.push(promise);
    }
  }

  const trackByPlaylist = await Promise.all(trackPromises);

  let allTracks = trackByPlaylist.flat();

  for (let i = allTracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
  }
  return maxRounds ? allTracks.slice(0, maxRounds) : allTracks;
};
const startNewRound = (
  io: Server,
  roomCode: string,
  currentGame: GameState,
  activeGames: Map<string, GameState>,
) => {
  currentGame.phase = "GUESS_SONG";

  currentGame.roundCorrectPlayers = {};
  currentGame.roundOwnerGuesses = {};

  const nextTrack = currentGame.tracks[currentGame.currentTrack];

  io.to(roomCode).emit("newTrack", {
    previewUrl: nextTrack.previewUrl,
    currentTrack: currentGame.currentTrack + 1,
  });
  setTimeout(() => {
    if (activeGames.has(roomCode) && currentGame.phase === "GUESS_SONG") {
      startOwnerGuessPhase(io, roomCode, currentGame, activeGames);
    }
  }, 30000);
};

const startOwnerGuessPhase = (
  io: Server,
  roomCode: string,
  currentGame: GameState,
  activeGames: Map<string, GameState>,
) => {
  currentGame.phase = "GUESS_OWNER";
  const currentTrack = currentGame.tracks[currentGame.currentTrack];

  io.to(roomCode).emit("songPhaseEnded", {
    phase: currentGame.phase,
    title: currentTrack.title,
    artist: currentTrack.artist,
  });
  setTimeout(() => {
    if (activeGames.has(roomCode) && currentGame.phase === "GUESS_OWNER") {
      endRoundAndNext(io, roomCode, currentGame, activeGames);
    }
  }, 15000);
};
const endRoundAndNext = (
  io: Server,
  roomCode: string,
  currentGame: GameState,
  activesGames: Map<string, GameState>,
) => {
  const currentTrack = currentGame.tracks[currentGame.currentTrack];

  if (currentGame.roundOwnerGuesses) {
    for (const [playerIdStr, guessOwnerId] of Object.entries(
      currentGame.roundOwnerGuesses,
    )) {
      const playerId = Number(playerIdStr);
      if (guessOwnerId === currentTrack.ownerId) {
        currentGame.scores[playerId] = (currentGame.scores[playerId] || 0) + 5; // + 5 point si le guess est juste
      }
    }
  }
  io.to(roomCode).emit("roundSummary", {
    ownerId: currentTrack.ownerId,
    scores: currentGame.scores,
  });

  currentGame.currentTrack++;

  if (currentGame.currentTrack >= currentGame.tracks.length) {
    currentGame.phase = "SCOREBOARD";
    io.to(roomCode).emit("gameOver", { finalScores: currentGame.scores });
  } else {
    setTimeout(() => {
      if (activesGames.has(roomCode)) {
        startNewRound(io, roomCode, currentGame, activesGames);
      }
    }, 5000);
  }
};

const processSongGuess = (
  currentGame: GameState,
  userId: number,
  guessedTrackId: string,
): boolean => {
  const currentTrack = currentGame.tracks[currentGame.currentTrack];
  if (guessedTrackId === currentTrack.id) {
    if (!currentGame.roundCorrectPlayers) currentGame.roundCorrectPlayers = {};
    if (currentGame.roundCorrectPlayers[userId]) return false;
    currentGame.roundCorrectPlayers[userId] = true;
    if (!currentGame.scores[userId]) currentGame.scores[userId] = 0;
    currentGame.scores[userId] += 10;
    return true;
  } else {
    return false;
  }
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

export default {
  prepareTracks,
  startNewRound,
  processSongGuess,
  processOwnerGuess,
};
