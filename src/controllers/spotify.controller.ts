import { Request, Response, NextFunction } from "express";
import AppError from "../errors/appError.js";
import spotifyService from "../services/spotify.service.js";
import authService from "../services/auth.service.js";
import userModel from "../models/user.model.js";
import { AuthenticateRequest } from "../types/express.type.js";

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
    const tokenData = await spotifyService.getTokens(code);
    const profile = await spotifyService.getSpotifyProfile(
      tokenData.access_token,
    );
    const expireAt = new Date(Date.now() + tokenData.expires_in * 1000); // calcul de la date d'expiration
    let existingUser = await userModel.findSpotifyId(profile.spotifyId);
    if (existingUser) {
      await userModel.updateToken(existingUser.id, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expire_at: expireAt,
      });
      const jwtToken = authService.generateToken(
        existingUser.id,
        existingUser.username,
      );
      res.json({
        message: "Connexion réussie",
        user: existingUser,
        token: jwtToken,
      });
    } else {
      const tempUsername = `Spo_${profile.spotifyId.substring(0, 6)}`;
      const newUser = await userModel.createUser({
        spotifyId: profile.spotifyId,
        email: profile.email,
        username: tempUsername,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expire_at: expireAt,
      });
      const jwtToken = authService.generateToken(newUser.id, newUser.username);
      res.status(201).json({
        message: "Inscription automatique réussie",
        user: newUser,
        token: jwtToken,
        isNewUser: true,
      });
    }
  } catch (error) {
    next(error);
  }
};

const updateUsername = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {  username } = req.body;
    const userId = req.user?.id
    if (!userId) {
      throw new AppError("Non Authentifié", 400);
    }
    if (!username || username.trim() === "") {
      throw new AppError("username sont requis", 400);
    }
   
    await userModel.updateUsername(userId, username);
    const newToken = authService.generateToken(userId, username);
    res.json({
      message: "Username mis à jour avec succès",
      token: newToken,
      user: { userId: userId, username },
    });
  } catch (error) {
    next(error);
  }
};
export default { LoginWithSpotify, callback, updateUsername };
