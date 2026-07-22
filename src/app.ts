import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./sockets/index.js";

const app = express();

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", //url frontend
    methods: ["GET", "POST"],
  },
});

setupSocketHandlers(io);
export { app, httpServer, io };
