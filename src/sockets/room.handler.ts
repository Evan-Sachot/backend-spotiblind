import { GameState } from "../types/game.types.js";
import { TypedServer, AuthenticateSocket } from "../types/socket.types.js";
import gameService from "../services/game.service.js";

const DISCONNECT_GRACE_MS = 15000; 

// Génère un code de salon à 6 caractères alphanumériques (ex: 8537C4)
const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const handleRoomEvents = (
  io: TypedServer,
  socket: AuthenticateSocket,
  activePlayers: Map<number, string>, 
  activeGames: Map<string, GameState>, 
) => {
  const user = socket.data.user;

// FERMETURE D'UN SALON (hôte ou déconnexion de l'hôte)
  const closeRoom = (roomCode: string, currentGame: GameState, message: string) => {
    io.to(roomCode).emit("roomClosed", { message });

    for (const playerIdStr of Object.keys(currentGame.players)) {
      activePlayers.delete(Number(playerIdStr));
    }
    activeGames.delete(roomCode);
    io.in(roomCode).socketsLeave(roomCode);
  };

  // RECONNEXION D'UN JOUEUR (grâce de 15s après déconnexion)
  if (activePlayers.has(user.id)) {
    const previousRoom = activePlayers.get(user.id) as string;
    const previousGame = activeGames.get(previousRoom);

    if (previousGame) {
      socket.join(previousRoom);
      console.log(`${user.username} reconnecté au salon ${previousRoom}`);
      socket.emit("roomRejoined", {
        roomCode: previousRoom,
        phase: previousGame.phase,
        players: gameService.getPublicPlayers(previousGame),
        roomHost: previousGame.roomHost,
      });
    }
  }

// CREATION D'UN SALON (hôte)
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
      players: { [user.id]: { username: user.username, score: 0 } },
    };
    activeGames.set(roomCode, initialGameState);

    console.log(`Salon ${roomCode} créé par ${user.username}`);

    socket.emit("roomCreated", {
      roomCode: roomCode,
      players: gameService.getPublicPlayers(initialGameState),
      roomHost: user.username,
    });
  });

// JOIN
  socket.on("joinRoom", (roomCode: string) => {
    const currentGame = activeGames.get(roomCode);
    if (!currentGame) {
      return socket.emit("error", { message: "Ce salon n'existe pas." });
    }
    if (currentGame.phase !== "LOBBY") {
      return socket.emit("error", { message: "La partie a déjà commencé." });
    }

    socket.join(roomCode);
    activePlayers.set(user.id, roomCode);
    currentGame.players[user.id] = { username: user.username, score: 0 };

    console.log(`${user.username} a rejoint le salon ${roomCode}`);

    const players = gameService.getPublicPlayers(currentGame);
    socket.emit("roomJoined", {
      roomCode,
      players,
      roomHost: currentGame.roomHost,
    });
    socket.to(roomCode).emit("roomUpdated", {
      players,
      roomHost: currentGame.roomHost,
      message: `${user.username} a rejoint le salon !`,
    });
  });

// LEAVE
  socket.on("leaveRoom", () => {
    const currentRoom = activePlayers.get(user.id);
    if (!currentRoom) return;

    const currentGame = activeGames.get(currentRoom);
    if (currentGame) {
      if (currentGame.roomHost === user.username) {
        console.log(`L'hôte ${user.username} a fermé le salon ${currentRoom}`);
        closeRoom(
          currentRoom,
          currentGame,
          `L'hôte ${user.username} a fermé le salon.`,
        );
        return;
      }
      delete currentGame.players[user.id];

      if (Object.keys(currentGame.players).length === 0) {
        activeGames.delete(currentRoom);
        console.log(`Salon ${currentRoom} vide, suppression.`);
      } else {
        socket.to(currentRoom).emit("roomUpdated", {
          players: gameService.getPublicPlayers(currentGame),
          roomHost: currentGame.roomHost,
          message: `${user.username} a quitté le salon.`,
        });
      }
    }

    socket.leave(currentRoom);
    activePlayers.delete(user.id);
    console.log(`${user.username} a quitté le salon ${currentRoom}`);
  });


  socket.on("disconnect", () => {
    const currentRoom = activePlayers.get(user.id);
    if (!currentRoom) return;

    console.log(`${user.username} a perdu la connexion. Grâce de 15s...`);

    const gameNow = activeGames.get(currentRoom);
    if (gameNow) {
      socket.to(currentRoom).emit("roomUpdated", {
        players: gameService.getPublicPlayers(gameNow),
        roomHost: gameNow.roomHost,
        message: `${user.username} a perdu la connexion...`,
      });
    }

    setTimeout(() => {
      const isStillRegistered = activePlayers.get(user.id) === currentRoom;
      const currentGame = activeGames.get(currentRoom);
      if (!currentGame || !isStillRegistered) return;

      const socketsInRoom = io.sockets.adapter.rooms.get(currentRoom);
      let hasReconnected = false;
      if (socketsInRoom) {
        for (const socketId of socketsInRoom) {
          const s = io.sockets.sockets.get(socketId);
          if (s && s.data.user.id === user.id) {
            hasReconnected = true;
            break;
          }
        }
      }
      if (hasReconnected) return; 

      if (currentGame.roomHost === user.username) {
        console.log(
          `Hôte ${user.username} définitivement déconnecté : fermeture de ${currentRoom}.`,
        );
        closeRoom(
          currentRoom,
          currentGame,
          "Connexion perdue avec l'hôte. Le salon est fermé.",
        );
        return;
      }

      console.log(`${user.username} ne s'est pas reconnecté à temps.`);
      delete currentGame.players[user.id];
      activePlayers.delete(user.id);

      if (Object.keys(currentGame.players).length === 0) {
        activeGames.delete(currentRoom);
      } else {
        io.to(currentRoom).emit("roomUpdated", {
          players: gameService.getPublicPlayers(currentGame),
          roomHost: currentGame.roomHost,
          message: `${user.username} a été déconnecté.`,
        });
      }
    }, DISCONNECT_GRACE_MS);
  });
};