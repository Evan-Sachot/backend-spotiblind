import { Server } from "socket.io";
import { AuthenticateSocket } from "../types/socket.types.js";
import { GameState, BlindTestTrack } from "../types/game.types.js";

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
      if (!currentGame.playlists) {
        currentGame.playlists = {};
      }
      currentGame.playlists[user.id] = playlistId;
      console.log(`${user.username} a choisi une playlist salon${roomCode}`);

      io.to(roomCode).emit("playerSelectedPlaylist", {
        userId: user.id,
        playlistId: playlistId,
      });
    }
  });

  socket.on("startGame", async () => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return;
    const currentGame = activeGames.get(roomCode);
    if (!currentGame || currentGame.roomHost != user.username) return;

    try {
      console.log(
        `lancement de la partie par l'host ${currentGame.roomHost} du salon ${currentGame.code}`,
      );
      currentGame.phase = "GUESS_SONG";
      io.to(roomCode).emit("gameStarted", currentGame);
    } catch (error) {
      console.error("Erreur au lancement");
      socket.emit("gameError", { message: "Impossible de lancer la partie" });
    }
  });
};
