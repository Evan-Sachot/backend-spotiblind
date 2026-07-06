import { Server, Socket } from "socket.io";
import { AuthenticateSocket } from "../types/socket.types.js";
import { GameState } from "../types/game.types.js";

const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};
export const handleRoomEvents = (
  io: Server,
  socket: AuthenticateSocket,
  activePlayers: Map<number, string>,
  activeGames: Map<string, GameState>,
) => {
  const user = socket.data.user;
  //Reconnexion automatique
  if (activePlayers.has(user.id)) {
    const previousRoom = activePlayers.get(user.id) as string;
    socket.join(previousRoom);
    console.log(`${user.username} reconnecté au salon ${previousRoom}`);
    socket.emit("roomRejoined", previousRoom);
  }
  //Creation d'une room lobby
  socket.on("createRoom", () => {
    const roomCode = generateRoomCode();
    socket.join(roomCode);
    activePlayers.set(user.id, roomCode);
    const initialGameState: GameState = {
      roomHost: user.username,
      code: roomCode,
      phase: "LOBBY",
      tracks: [],
      currentTrack: 0,
      scores: { [user.id]: 0 },
    };
    activeGames.set(roomCode, initialGameState);
    console.log(`room${roomCode} créé par ${user.username}`);
    socket.emit("roomCreated", roomCode);
  });
  //join room lobby
  socket.on("joinRoom", (roomCode: string) => {
    const currentGame = activeGames.get(roomCode);
    if (currentGame) {
      socket.join(roomCode);
      activePlayers.set(user.id, roomCode);
      currentGame.scores[user.id] = 0;
      console.log(`${user.username} connecté au salon ${roomCode}`);
      socket.to(roomCode).emit("playerJoined", {
        message: `${user.username} a rejoint le salon !`,
        user: { id: user.id, username: user.username },
      });
      socket.emit("roomJoined", roomCode);
    } else {
      console.log("Room inexistante");
    }
  });
  //leave
  socket.on("leaveRoom", () => {
    const currentRoom = activePlayers.get(user.id);
    if (currentRoom) {
      const currentGame = activeGames.get(currentRoom);
      if (currentGame) {
        if (currentGame.roomHost === user.username) {
          console.log(
            `L'hôte ${user.username} a fermé le salon ${currentRoom}`,
          );
          io.to(currentRoom).emit("roomClosed", {
            message: `L'hôte ${user.username} a fermé le salon ${currentRoom}`,
          });
          for (const playerIdStr of Object.keys(currentGame.scores)) {
            activePlayers.delete(Number(playerIdStr));
          }
          activeGames.delete(currentRoom);
          io.in(currentRoom).socketsLeave(currentRoom);
          return;
        }
        delete currentGame.scores[user.id];
        //verification du nombre de joueurs actif delete de la room si vide
        if (Object.keys(currentGame.scores).length === 0) {
          activeGames.delete(currentRoom);
          console.log(`${currentRoom} vide suppression de la partie.`);
        }
      }
      socket.leave(currentRoom);
      activePlayers.delete(user.id);
      console.log(`${user.username} a quitté le salon ${currentRoom}`);
      socket.to(currentRoom).emit("playerLeft", {
        message: `${user.username} a quitté le salon${currentRoom}`,
        userId: user.id,
      });
      socket.emit("roomLeft");
    }
  });
  socket.on("disconnect", () => {
    const currentRoom = activePlayers.get(user.id);

    if (currentRoom) {
      console.log(`${user.username} a perdu la connexion. En attente (15s)...`);

      socket.to(currentRoom).emit("playerDisconnected", {
        userId: user.id,
        message: `${user.username} a perdu la connexion. En attente (15s)...`,
      });

      setTimeout(() => {
        const isStillInRoom = activePlayers.get(user.id) === currentRoom;
        const currentGame = activeGames.get(currentRoom);

        if (currentGame && isStillInRoom) {
          if (currentGame.roomHost === user.username) {
            console.log(
              `L'hôte ${user.username} a perdu la connexion. suppression du salon ${currentRoom}.`,
            );

            io.to(currentRoom).emit("roomClosed", {
              message: "Connexion perdue avec l'hôte. Le salon est fermé.",
            });

            for (const playerIdStr of Object.keys(currentGame.scores)) {
              activePlayers.delete(Number(playerIdStr));
            }
            activeGames.delete(currentRoom);
            io.in(currentRoom).socketsLeave(currentRoom);
            return;
          }
          console.log(`${user.username} ne s'est pas reconnecté à temps.`);
          delete currentGame.scores[user.id];
          activePlayers.delete(user.id);

          io.to(currentRoom).emit("playerLeft", {
            message: `${user.username} a été déconnecté.`,
            userId: user.id,
          });

          if (Object.keys(currentGame.scores).length === 0) {
            activeGames.delete(currentRoom);
          }
        }
      }, 15000);
    }
  });
};
