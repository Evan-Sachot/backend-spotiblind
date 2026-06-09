import { Server, Socket } from "socket.io";

const activePlayer = new Map<number, string>(); //joueurs actif dans un salon

const genereteRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};
export const handleRoomEvents = (io: Server, socket: Socket) => {
  const user = socket.data.user;
  if (activePlayer.has(user.id)) {
    const previousRoom = activePlayer.get(user.id) as string;
    socket.join(previousRoom);
    console.log(`${user.username} reconnecté au salon ${previousRoom}`);
    socket.emit("roomRejoined", previousRoom);
  }
  socket.on("createRoom", () => {
    const roomCode = genereteRoomCode();
    socket.join(roomCode);
    activePlayer.set(user.id, roomCode);
    console.log(`room${roomCode} créé par ${user.username}`);
    socket.emit("roomCreated", roomCode);
  });
  socket.on("join", (roomCode: string) => {
    socket.join(roomCode);
    activePlayer.set(user.id, roomCode);
    console.log(`${user.username} connecté au salon ${roomCode}`);
    socket.emit("roomJoined", roomCode);
  });
};
