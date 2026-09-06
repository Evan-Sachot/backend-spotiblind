import { GameState } from "../types/game.types.js";
import { TypedServer, AuthenticateSocket } from "../types/socket.types.js";
import gameService, {
  DEFAULT_MAX_ROUNDS,
  DEFAULT_GUESS_TIME,
} from "../services/game.service.js";

export const handleGameEvents = (
  io: TypedServer,
  socket: AuthenticateSocket,
  activePlayers: Map<number, string>,
  activeGames: Map<string, GameState>,
) => {
  const user = socket.data.user;
  const getGame = (): { roomCode: string; game: GameState } | undefined => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return undefined;
    const game = activeGames.get(roomCode);
    if (!game) return undefined;
    return { roomCode, game };
  };

// CHOIX DE PLAYLISTS
  socket.on("selectPlaylist", (playlistId: string) => {
    const ctx = getGame();
    if (!ctx || ctx.game.phase !== "LOBBY") return;

    if (!ctx.game.playlists) ctx.game.playlists = {};
    ctx.game.playlists[user.id] = playlistId;
    io.to(ctx.roomCode).emit("playerSelectedPlaylist", {
      userId: user.id,
      playlistId: playlistId,
    });
  });

// REGLAGE DE LA PARTIE
  const broadcastSettings = (roomCode: string, game: GameState) => {
    io.to(roomCode).emit("settingsUpdated", {
      maxRounds: game.maxRounds ?? DEFAULT_MAX_ROUNDS,
      guessTime: game.guessTime ?? DEFAULT_GUESS_TIME,
    });
  };

  socket.on("setMaxRounds", (maxRounds: number) => {
    const ctx = getGame();
    if (!ctx || ctx.game.phase !== "LOBBY" || ctx.game.roomHost !== user.username) return;
    if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 50) return;

    ctx.game.maxRounds = maxRounds;
    broadcastSettings(ctx.roomCode, ctx.game);
  });

  socket.on("setGuessTime", (guessTime: number) => {
    const ctx = getGame();
    if (!ctx || ctx.game.phase !== "LOBBY" || ctx.game.roomHost !== user.username) return;

    if (!Number.isInteger(guessTime) || guessTime < 5 || guessTime > 60) return;

    ctx.game.guessTime = guessTime;
    broadcastSettings(ctx.roomCode, ctx.game);
  });

// LANCEMENT DE LA PARTIE
  socket.on("startGame", async () => {
    const ctx = getGame();
    if (!ctx || ctx.game.roomHost !== user.username) return;
    const { roomCode, game } = ctx;

    if (!game.playlists || Object.keys(game.playlists).length === 0) {
      return socket.emit("error", { message: "Aucune playlist sélectionnée." });
    }

    try {
      console.log(`Lancement de la partie ${game.code} par ${user.username}`);

      const allTracks = await gameService.prepareTracks(
        game.playlists,
        game.maxRounds ?? DEFAULT_MAX_ROUNDS,
      );

      if (allTracks.length === 0) {
        return socket.emit("error", {
          message: "Les playlists sélectionnées sont vides.",
        });
      }

      game.tracks = allTracks;
      game.currentTrack = 0;
      delete game.playlists;

      io.to(roomCode).emit("gameStarted", {
        totalTracks: game.tracks.length,
      });
      setTimeout(() => {
        gameService.startNewRound(io, roomCode, game, activeGames);
      }, 3000);
    } catch (error) {
      console.error("Erreur lancement de partie", error);
      socket.emit("error", {
        message: "Impossible de récupérer les musiques. Réessaie.",
      });
    }
  });

// REPONSE
  socket.on("submitSongGuess", (guess) => {
    const ctx = getGame();
    if (!ctx || ctx.game.phase !== "GUESS_SONG") return;
    if (!guess || typeof guess.title !== "string" || typeof guess.artist !== "string") return;

    const isCorrect = gameService.processSongGuess(ctx.game, user.id, guess);

    if (isCorrect) {
      io.to(ctx.roomCode).emit("playerFoundSong", {
        userId: user.id,
        username: user.username,
      });
    }
    socket.emit("guessResult", { correct: isCorrect });
  });


  socket.on("submitOwnerGuess", (ownerId: number) => {
    const ctx = getGame();
    if (!ctx || ctx.game.phase !== "GUESS_OWNER") return;

    gameService.processOwnerGuess(ctx.game, user.id, ownerId);
  
  });

// RELANCE DE LA PARTIE
  socket.on("playAgain", () => {
    const ctx = getGame();
    if (
      !ctx ||
      ctx.game.roomHost !== user.username ||
      ctx.game.phase !== "SCOREBOARD"
    )
      return;

    console.log(`Partie ${ctx.game.code} relancée par ${user.username}`);
    gameService.resetGameToLobby(ctx.game);

    io.to(ctx.roomCode).emit("gameReset", {
      message: "L'hôte a relancé une partie, retour au lobby.",
    });
  });
};