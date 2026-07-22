// ============================================================
// GAME HANDLER — Le "standardiste" : écoute les événements,
// vérifie les droits, délègue les calculs au game.service.
// ============================================================
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

  // Helper : retrouve la partie du joueur (ou undefined)
  const getGame = (): { roomCode: string; game: GameState } | undefined => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return undefined;
    const game = activeGames.get(roomCode);
    if (!game) return undefined;
    return { roomCode, game };
  };

  // ------------------------------------------------------------
  // CHOIX DE PLAYLIST (chaque joueur, pendant le LOBBY)
  // ------------------------------------------------------------
  socket.on("selectPlaylist", (playlistId: string) => {
    const ctx = getGame();
    if (!ctx || ctx.game.phase !== "LOBBY") return;

    if (!ctx.game.playlists) ctx.game.playlists = {};
    ctx.game.playlists[user.id] = playlistId;

    // On informe le salon (permet d'afficher "prêt" à côté du joueur)
    io.to(ctx.roomCode).emit("playerSelectedPlaylist", {
      userId: user.id,
      playlistId: playlistId,
    });
  });

  // ------------------------------------------------------------
  // RÉGLAGES DE L'HÔTE (nombre de manches / temps de réponse)
  // Un seul événement de diffusion : settingsUpdated, qui renvoie
  // TOUS les réglages courants (plus simple à consommer côté front)
  // ------------------------------------------------------------
  const broadcastSettings = (roomCode: string, game: GameState) => {
    io.to(roomCode).emit("settingsUpdated", {
      maxRounds: game.maxRounds ?? DEFAULT_MAX_ROUNDS,
      guessTime: game.guessTime ?? DEFAULT_GUESS_TIME,
    });
  };

  socket.on("setMaxRounds", (maxRounds: number) => {
    const ctx = getGame();
    // Seul l'hôte règle la partie, et uniquement au lobby
    if (!ctx || ctx.game.phase !== "LOBBY" || ctx.game.roomHost !== user.username) return;

    // Garde-fou : bornes raisonnables (évite un maxRounds négatif ou délirant)
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

  // ------------------------------------------------------------
  // LANCEMENT DE LA PARTIE (hôte uniquement)
  // Plus aucun paramètre : les réglages sont déjà dans le GameState
  // ------------------------------------------------------------
  socket.on("startGame", async () => {
    const ctx = getGame();
    if (!ctx || ctx.game.roomHost !== user.username) return;
    const { roomCode, game } = ctx;

    if (!game.playlists || Object.keys(game.playlists).length === 0) {
      // CONTRAT : un seul canal d'erreur, toujours un objet { message }
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
      delete game.playlists; // plus besoin, et ça évite de traîner des données inutiles

      io.to(roomCode).emit("gameStarted", {
        totalTracks: game.tracks.length,
      });

      // 3 secondes de transition (écran "la partie commence") puis manche 1
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

  // ------------------------------------------------------------
  // RÉPONSE : deviner la musique (phase GUESS_SONG)
  // CONTRAT : { trackId, title, artist } — la vérification par
  // titre+artiste (game.service) tolère les IDs différents entre
  // éditions Spotify de la même chanson
  // ------------------------------------------------------------
  socket.on("submitSongGuess", (guess) => {
    const ctx = getGame();
    if (!ctx || ctx.game.phase !== "GUESS_SONG") return;
    // Garde-fou : payload malformé (client modifié) -> ignoré
    if (!guess || typeof guess.title !== "string" || typeof guess.artist !== "string") return;

    const isCorrect = gameService.processSongGuess(ctx.game, user.id, guess);

    if (isCorrect) {
      // Tout le salon voit que ce joueur a trouvé (sans révéler la réponse)
      io.to(ctx.roomCode).emit("playerFoundSong", {
        userId: user.id,
        username: user.username,
      });
    }
    // Feedback personnel (bordure verte/rouge de l'input sur la maquette)
    socket.emit("guessResult", { correct: isCorrect });
  });

  // ------------------------------------------------------------
  // RÉPONSE : voter le propriétaire (phase GUESS_OWNER)
  // CONTRAT : le front envoie un NUMBER nu
  // ------------------------------------------------------------
  socket.on("submitOwnerGuess", (ownerId: number) => {
    const ctx = getGame();
    if (!ctx || ctx.game.phase !== "GUESS_OWNER") return;

    gameService.processOwnerGuess(ctx.game, user.id, ownerId);
    // Pas de confirmation dédiée : le vote est silencieux jusqu'au roundSummary
  });

  // ------------------------------------------------------------
  // REJOUER (hôte, depuis l'écran SCOREBOARD)
  // ------------------------------------------------------------
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