import { Server, Socket } from "socket.io";
import AppError from "../errors/appError.js";
import jwt, { JsonWebTokenError } from "jsonwebtoken";
import { handleRoomEvents } from "./room.handler.js";
import { JwtUserPayload, AuthenticateSocket } from "../types/socket.types.js";
import { handleGameEvents } from "./game.handler.js";
import { GameState } from "../types/game.types.js";

export const setupSocketHandlers = (io: Server) => {
  const activePlayers = new Map<number, string>(); //joueurs actif dans un salon
  const activeGames = new Map<string, GameState>(); //salon actif et leurs états
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token; // recuperation du token envoyé par le front
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
  io.on("connection", (socket: AuthenticateSocket) => {
    console.log(
      `Un joueur est connecté:${socket.data.user.username} ID:${socket.id}`,
    );
    handleGameEvents(io, socket, activePlayers, activeGames);
    handleRoomEvents(io, socket, activePlayers, activeGames);
    socket.on("disconnect", () => {
      console.log(
        `Joueur déconnecté:${socket.data.user.username} ID:${socket.id}`,
      );
    });
  });
};
