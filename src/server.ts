import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import spotifyRoutes from "./routes/spotify.routes.js";
import { setupSocketHandlers } from "./sockets/index.js";

dotenv.config();

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// CORS pour les requêtes HTTP classiques (fetch du front)
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Routes REST
app.use("/api", spotifyRoutes);

// ⚠️ POINT CRITIQUE N°1 : le serveur HTTP doit ENVELOPPER app,
// et c'est LUI (server) qui écoutera — pas app directement
const server = http.createServer(app);

// ⚠️ POINT CRITIQUE N°2 : io est attaché à server (le même !),
// avec le CORS du front (5173, pas 3000)
const io = new Server(server, {
  cors: { origin: FRONTEND_URL },
});

// Branchement de toute la logique temps réel (rooms + game)
setupSocketHandlers(io);

const PORT = process.env.PORT ?? 5000;

// ⚠️ POINT CRITIQUE N°3 : server.listen, PAS app.listen.
// Avec app.listen(PORT), Express crée son propre serveur HTTP
// interne qui ignore totalement io → GET /socket.io répond 404
// (exactement ton symptôme).
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});