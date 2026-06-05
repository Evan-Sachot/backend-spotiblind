import { Request, Response, NextFunction } from "express";
import AppError from "../errors/appError.js";
import spotifyService from "../services/spotify.service.js";

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
    res.json({
      message: "Connexion réussie",
      tokens: token,
      spotifyId: profile.spotifyId,
      email: profile.email,
    });
  } catch (error) {
    next(error);
  }
};

export default { LoginWithSpotify, callback };
