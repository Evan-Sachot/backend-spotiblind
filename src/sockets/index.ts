// ============================================================
// SOCKETS INDEX — Point d'entrée : authentification JWT du
// socket puis branchement des handlers (rooms + game).
// ============================================================
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
  // On "verrouille" le serveur avec notre contrat d'événements :
  // à partir d'ici, tout emit/on hors contrat = erreur de compilation
  const typedIo = io as TypedServer;

  const activePlayers = new Map<number, string>(); // userId -> roomCode (index rapide)
  const activeGames = new Map<string, GameState>(); // roomCode -> état complet du salon

  // --- MIDDLEWARE D'AUTHENTIFICATION ---
  // Chaque connexion socket doit présenter le JWT (envoyé par le
  // front dans socket.handshake.auth.token). Sinon : rejet.
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
      socket.data.user = decodedPlayer; // typé grâce à CustomSocketData
      next();
    } catch (error) {
      return next(new Error("Token invalide ou expiré"));
    }
  });

  // --- BRANCHEMENT DES HANDLERS ---
  typedIo.on("connection", (socket: AuthenticateSocket) => {
    console.log(
      `Joueur connecté : ${socket.data.user.username} (socket ${socket.id})`,
    );

    handleRoomEvents(typedIo, socket, activePlayers, activeGames);
    handleGameEvents(typedIo, socket, activePlayers, activeGames);
    // NOTE : le disconnect est géré DANS room.handler (grâce de 15s)
  });
};