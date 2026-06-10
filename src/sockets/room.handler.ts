import { Server, Socket } from "socket.io";
import { AuthenticateSocket } from "../types/socket.types.js";
const activePlayer = new Map<number, string>(); //joueurs actif dans un salon

const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};
export const handleRoomEvents = (io: Server, socket: AuthenticateSocket) => {
  const user = socket.data.user;
  if (activePlayer.has(user.id)) {
    const previousRoom = activePlayer.get(user.id) as string;
    socket.join(previousRoom);
    console.log(`${user.username} reconnecté au salon ${previousRoom}`);
    socket.emit("roomRejoined", previousRoom);
  }
  socket.on("createRoom", () => {
    const roomCode = generateRoomCode();
    socket.join(roomCode);
    activePlayer.set(user.id, roomCode);
    console.log(`room${roomCode} créé par ${user.username}`);
    socket.emit("roomCreated", roomCode);
  });
  socket.on("joinRoom", (roomCode: string) => {
    socket.join(roomCode);
    activePlayer.set(user.id, roomCode);
    console.log(`${user.username} connecté au salon ${roomCode}`);
    socket.to(roomCode).emit("playerJoined", {
      message: `${user.username} a rejoint le salon !`,
      user: { id: user.id, username: user.username },
    });
    socket.emit("roomJoined", roomCode);
  });
  socket.on("leaveRoom", () => {
    const currentRoom = activePlayer.get(user.id);
    if (currentRoom) {
      socket.leave(currentRoom);
      activePlayer.delete(user.id);
      console.log(`${user.username} a quitté le salon ${currentRoom}`);
      socket.to(currentRoom).emit("playerLeft", {
        message: `${user.username} a quitté le salon`,
        userId: user.id,
      });
      socket.emit("roomLeft");
    }
  });
};
