import { Request, Response, NextFunction } from "express";
import AppError from "../errors/appError.js";
import spotifyService from "../services/spotify.service.js";
import authService from "../services/auth.service.js";
import userModel from "../models/user.model.js";
import { AuthenticateRequest } from "../types/express.type.js";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

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

//ECHANGE DES TOKENS REDIRECTION FRONTEND
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
    const expireAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const existingUser = await userModel.findSpotifyId(profile.spotifyId);

    if (existingUser) {
// JOUEUR CONNU
      await userModel.updateToken(existingUser.id, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expire_at: expireAt,
      });
      const jwtToken = authService.generateToken(
        existingUser.id,
        existingUser.username,
      );
      res.redirect(`${FRONTEND_URL}/login?token=${jwtToken}`);
    } else {
  // NOUVEAU JOUEUR CONNEXION AUTOMATIQUE PSEUDO TEMPORAIRE
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

      // newUser=true => affichera le formulaire de pseudo
      res.redirect(`${FRONTEND_URL}/login?token=${jwtToken}&newUser=true`);
    }
  } catch (error) {
    console.error("Erreur callback Spotify :", error);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
};

//MISE A JOUR DU PSEUDO
const updateUsername = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { username } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Non authentifié", 401);
    }
    if (typeof username !== "string") {
      throw new AppError("Le nouveau pseudo est requis", 400);
    }
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 15) {
      throw new AppError("Le pseudo doit faire entre 3 et 15 caractères", 400);
    }
    if (!/^[a-zA-Z0-9À-ÿ_-]+$/.test(cleanUsername)) {
      throw new AppError(
        "Le pseudo contient des caractères non autorisés",
        400,
      );
    }
    await userModel.updateUsername(userId, cleanUsername);
    const newToken = authService.generateToken(userId, cleanUsername);

    res.json({
      message: "Username mis à jour",
      token: newToken,
      user: { id: userId, cleanUsername },
    });
  } catch (error) {
    next(error);
  }
};

//recherche de titre auto completion
const searchTracks = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const query = req.query.q as string;
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Non authentifié", 401);
    }
    if (!query || query.trim() === "") {
      res.json({ tracks: [] }); 
      return;
    }
    const tokens = await userModel.getSpotifyToken(userId);
    if (!tokens) {
      throw new AppError("Utilisateur introuvable", 404);
    }
    const tracks = await spotifyService.searchTracks(
      userId,
      tokens.access_token,
      query,
    );
    res.json({ tracks }); 
  } catch (error) {
    next(error);
  }
};
const getPlaylists = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Non authentifié", 401);
    }
    const tokens = await userModel.getSpotifyToken(userId);
    if (!tokens) {
      throw new AppError("Utilisateur introuvable", 404);
    }
    const playlists = await spotifyService.getUserPlaylist(
      userId,
      tokens.access_token,
    );
    res.json({ playlists });
  } catch (error) {
    next(error);
  }
};

export default {
  LoginWithSpotify,
  callback,
  updateUsername,
  searchTracks,
  getPlaylists,
};
