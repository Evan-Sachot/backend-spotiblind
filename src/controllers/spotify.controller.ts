import { Request, Response, NextFunction } from "express";
import AppError from "../errors/appError.js";
import spotifyService from "../services/spotify.service.js";
import userModel from "../models/user.model.js";

const LoginWithSpotify = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authUrl = spotifyService.getSpotifyAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
};
const callback = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const code = req.query.code as string;
    if (!code) {
      throw new AppError("Code manquant ou refusé", 400);
    }
    const token = await spotifyService.getTokens(code);
    const profile = await spotifyService.getSpotifyProfile(token.access_token);
    const existingUser = await userModel.findSpotifyId(profile.spotifyId);
    if (existingUser) {
      res.json({ message: "Connexion réussie", user: existingUser });
    } else {
      res.json({
        message: "Nouvel utilisateur, redirection vers l'inscription",
        spotifyId: profile.spotifyId,
        email: profile.email,
      });
    }
  } catch (error) {
    next(error);
  }
};
const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { spotifyId, email, username } = req.body;
    if (!username || username.trim() === "") {
      throw new AppError("Pseudo obligatoire", 400);
    }
    if (!email || email.trim() === "") {
      throw new AppError("Email obligatoire", 400);
    }
    const newUser = await userModel.createUser({ spotifyId, email, username });
    res.status(201).json({ message: "User created", user: newUser });
  } catch (error) {
    next(error);
  }
};

export default { LoginWithSpotify, callback, register };
