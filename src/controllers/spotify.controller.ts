// ============================================================
// SPOTIFY CONTROLLER — Authentification OAuth + recherche.
//
// CORRECTION MAJEURE (callback) : Spotify redirige le NAVIGATEUR
// du joueur vers cette route. Un res.json() affichait donc du JSON
// brut à l'écran et le joueur restait bloqué sur le backend.
// La bonne réponse est une REDIRECTION HTTP vers le frontend,
// avec le token JWT dans l'URL — que useAuthLogic lit au montage
// de la page /login (puis nettoie de l'URL).
// ============================================================
import { Request, Response, NextFunction } from "express";
import AppError from "../errors/appError.js";
import spotifyService from "../services/spotify.service.js";
import authService from "../services/auth.service.js";
import userModel from "../models/user.model.js";
import { AuthenticateRequest } from "../types/express.type.js";

// URL du frontend pour les redirections post-authentification.
// ⚠️ Ajoute FRONTEND_URL=http://localhost:5173 dans ton .env backend
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// ------------------------------------------------------------
// ÉTAPE 1 : le joueur clique sur "Sign in with Spotify"
// -> on l'envoie sur la page d'autorisation Spotify
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// ÉTAPE 2 : Spotify renvoie le navigateur ici avec un ?code=...
// On échange le code contre les tokens, on crée/màj l'utilisateur,
// puis on REDIRIGE le navigateur vers le front avec notre JWT.
// ------------------------------------------------------------
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
    // Calcul de la date d'expiration de l'access_token Spotify
    const expireAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const existingUser = await userModel.findSpotifyId(profile.spotifyId);

    if (existingUser) {
      // --- JOUEUR CONNU : on rafraîchit ses tokens Spotify ---
      await userModel.updateToken(existingUser.id, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expire_at: expireAt,
      });
      const jwtToken = authService.generateToken(
        existingUser.id,
        existingUser.username,
      );

      // REDIRECTION (plus de res.json) : le front lit ?token= dans l'URL
      res.redirect(`${FRONTEND_URL}/login?token=${jwtToken}`);
    } else {
      // --- NOUVEAU JOUEUR : inscription automatique avec pseudo temporaire ---
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

      // newUser=true -> useAuthLogic affichera le formulaire de pseudo
      // au lieu de rediriger directement vers le lobby
      res.redirect(`${FRONTEND_URL}/login?token=${jwtToken}&newUser=true`);
    }
  } catch (error) {
    // En cas d'échec (code invalide, Spotify KO...), on ramène quand
    // même le joueur sur le front avec un indicateur d'erreur, plutôt
    // que de l'abandonner sur une page JSON du backend
    console.error("Erreur callback Spotify :", error);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
};

// ------------------------------------------------------------
// MISE À JOUR DU PSEUDO (première connexion)
// L'identité vient du JWT (middleware), jamais du body : un
// tricheur ne peut pas modifier le pseudo d'un autre joueur.
// ------------------------------------------------------------
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
    if (!username || username.trim() === "") {
      throw new AppError("Le nouveau pseudo est requis", 400);
    }

    await userModel.updateUsername(userId, username);
    // Nouveau token OBLIGATOIRE : le pseudo est encodé dedans,
    // le front le remplace puis reconnecte son socket avec
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

// ------------------------------------------------------------
// RECHERCHE DE TITRES (auto-complétion de l'écran de jeu)
// CONTRAT AVEC LE FRONT : réponse enveloppée { tracks: [...] }
// (le front fait data.tracks — un tableau nu casserait l'UI)
// ------------------------------------------------------------
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
      res.json({ tracks: [] }); // enveloppé, comme la réponse normale
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
    res.json({ tracks }); // enveloppé
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


export default { LoginWithSpotify, callback, updateUsername, searchTracks,getPlaylists };
