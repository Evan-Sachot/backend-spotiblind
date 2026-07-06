import { Server } from "socket.io";
import { AuthenticateSocket } from "../types/socket.types.js";
import { GameState } from "../types/game.types.js";
import gameService from "../services/game.service.js";

export const handleGameEvents = (
  io: Server,
  socket: AuthenticateSocket,
  activePlayers: Map<number, string>,
  activeGames: Map<string, GameState>,
) => {
  const user = socket.data.user;

  socket.on("selectPlaylist", (playlistId: string) => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return;
    const currentGame = activeGames.get(roomCode);
    if (currentGame && currentGame.phase === "LOBBY") {
      if (!currentGame.playlists) currentGame.playlists = {};

      currentGame.playlists[user.id] = playlistId;

      io.to(roomCode).emit("playerSelectedPlaylist", {
        userId: user.id,
        playlistId: playlistId,
      });
    }
  });

  socket.on("setMaxRounds", (maxRounds: number) => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return;
    const currentGame = activeGames.get(roomCode);

    if (
      currentGame &&
      currentGame.phase === "LOBBY" &&
      currentGame.roomHost === user.username
    ) {
      currentGame.maxRounds = maxRounds;
      io.to(roomCode).emit("maxRoundsSet", maxRounds);
    }
  });
  socket.on("startGame", async () => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return;
    const currentGame = activeGames.get(roomCode);

    if (!currentGame || currentGame.roomHost !== user.username) return;
    if (
      !currentGame.playlists ||
      Object.keys(currentGame.playlists).length === 0
    ) {
      return socket.emit("error", "Aucune playlist sélectionnée.");
    }
    try {
      console.log(
        `lancement de la partie salon ${currentGame.code} par ${user.username}`,
      );

      const allTracks = await gameService.prepareTracks(
        currentGame.playlists,
        currentGame.maxRounds,
      );
      if (allTracks.length === 0) {
        return socket.emit("gameError", {
          message: "Les playlists sélectionnées sont vides.",
        });
      }
      currentGame.tracks = allTracks;
      currentGame.currentTrack = 0;
      delete currentGame.playlists;

      io.to(roomCode).emit("gameStarted", {
        code: currentGame.code,
        roomHost: currentGame.roomHost,
        totalTracks: currentGame.tracks.length,
      });
      setTimeout(() => {
        gameService.startNewRound(io, roomCode, currentGame, activeGames);
      }, 3000);
    } catch (error) {
      console.error("Erreur lancement de partie", error);
      socket.emit("error", "Erreur lors du lancement de la partie.");
    }
  });

  socket.on("submitGuess", (guessTrackId: string) => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return;
    const currentGame = activeGames.get(roomCode);
    if (!currentGame || currentGame.phase !== "GUESS_SONG") return;
    const isCorrect = gameService.processSongGuess(
      currentGame,
      user.id,
      guessTrackId,
    );
    if (isCorrect) {
      io.to(roomCode).emit("playerFoundSong", {
        userId: user.id,
        username: user.username,
      });
      socket.emit("guessResult", { correct: true });
    } else {
      socket.emit("guessResult", { correct: false });
    }
  });

  socket.on("submitOwnerGuess", (guessOwnerId: number) => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return;
    const currentGame = activeGames.get(roomCode);
    if (!currentGame || currentGame.phase !== "GUESS_OWNER") return;
    const isValid = gameService.processOwnerGuess(
      currentGame,
      user.id,
      guessOwnerId,
    );
    if (isValid) {
      socket.emit("ownerGuessRegistered", { success: true });
    } else {
      socket.emit("ownerGuessRegistered", { success: false });
    }
  });

  socket.on("playAgain", () => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return;
    const currentGame = activeGames.get(roomCode);
    if (
      currentGame &&
      currentGame.roomHost === user.username &&
      currentGame.phase === "SCOREBOARD"
    ) {
      console.log(
        `redemarrage de la partie salon ${currentGame.code} par ${user.username}`,
      );

      gameService.resetGameToLobby(currentGame);

      io.to(roomCode).emit("gameReset", {
        message: "L'hote a relancer une partie, retour au lobby.",
      });
    }
  });
};
