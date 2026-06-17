import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import userModel from "../models/user.model.js";
import spotifyService from "./spotify.service.js";
import { decrypt } from "../utils/crypto.util.js";
import AppError from "../errors/appError.js";
import { UserTokens } from "../types/user.type.js";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "fallback_secret";

const generateToken = (userId: number, username: string) => {
  const payload = { userId, username };
  return jwt.sign(payload, jwtSecret, { expiresIn: "1h" });
};

export default { generateToken };
