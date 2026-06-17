import { Request, Response, NextFunction, response } from "express";
import AppError from "../errors/appError.js";
import spotifyService from "../services/spotify.service.js";
import authService from "../services/auth.service.js";
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
    const tokenData = await spotifyService.getTokens(code);
    const profile = await spotifyService.getSpotifyProfile(
      tokenData.access_token,
    );
    const expireAt = new Date(Date.now() + tokenData.expires_in * 1000); // calcul de la date d'expiration
    const existingUser = await userModel.findSpotifyId(profile.spotifyId);
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
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId, username } = req.body;
    if (!username || username.trim() === "") {
      throw new AppError("userId et username sont requis", 400);
    }
    if (!userId) {
      throw new AppError("userId manquant", 400);
    }
    await userModel.updateUsername(userId, username);
    const newToken = authService.generateToken(userId, username);
    res.json({
      message: "Username mis à jour avec succès",
      token: newToken,
      user: { id: userId, username },
    });
  } catch (error) {
    next(error);
  }
};

const getMyPlaylist = async (
  req: Request,
  res: Response,
  Next: NextFunction,
) => {
  try {
    const userId = (req as any).user?.id;
    if (userId) {
      throw new AppError("Utilisateur non authentifié", 401);
    }
    const tokens = await userModel.getSpotifyToken(userId);
    if (!tokens || !tokens.access_token) {
      throw new AppError("Spotify non lié", 404);
    }
    const playlists = await spotifyService.getUserPlaylist(tokens.access_token);
    res.status(200).json({ status: "success", data: { playlists } });
  } catch (error) {
    Next(error);
  }
};
export default { LoginWithSpotify, callback, updateUsername };
