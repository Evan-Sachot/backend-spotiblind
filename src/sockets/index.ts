import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { handleRoomEvents } from "./room.handler.js";
import { handleGameEvents } from "./game.handler.js";
import {
  JwtUserPayload,
  AuthenticateSocket,
  TypedServer,
} from "../types/socket.types.js";
import { GameState } from "../types/game.types.js";

export const setupSocketHandlers = (io: Server) => {
  const typedIo = io as TypedServer;

  const activePlayers = new Map<number, string>(); 
  const activeGames = new Map<string, GameState>(); 

// MIDDLAWERES D'AUTHENTIFICATION
  typedIo.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentification requise pour jouer"));
    }
    try {
      const decodedPlayer = jwt.verify(
        token,
        process.env.JWT_SECRET as string,
      ) as JwtUserPayload;
      socket.data.user = decodedPlayer; 
      next();
    } catch (error) {
      return next(new Error("Token invalide ou expiré"));
    }
  });

// GESTION DES EVENEMENTS
  typedIo.on("connection", (socket: AuthenticateSocket) => {
    console.log(
      `Joueur connecté : ${socket.data.user.username} (socket ${socket.id})`,
    );

    handleRoomEvents(typedIo, socket, activePlayers, activeGames);
    handleGameEvents(typedIo, socket, activePlayers, activeGames);
  });
};