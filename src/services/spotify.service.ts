import axios from "axios";
import AppError from "../errors/appError.js";
import {
  SpotifyAuthResponse,
  SpotifyTokenBodyParams,
  SpotifyPlaylist,
  SpotifyTrack,
} from "../types/spotify.js";
import { access } from "node:fs";
import { TokenExpiredError } from "jsonwebtoken";
import { title } from "node:process";

const getSpotifyAuthUrl = (): string => {
  const scope = "user-read-private user-read-email";
  const authQuery: SpotifyAuthResponse = {
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID || "",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI || "",
    scope,
  };
  // conversion en format URL
  const params = new URLSearchParams(authQuery as Record<string, string>);
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};
const getTokens = async (
  code: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> => {
  const clientId = process.env.SPOTIFY_CLIENT_ID || "";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
  const authBuffer = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  ); // Encodage en base64 de l'identifiant et du secret pour l'authentification spotify
  const tokenBody: SpotifyTokenBodyParams = {
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI || "",
    grant_type: "authorization_code",
  };
  const data = new URLSearchParams(
    tokenBody as Record<string, string>,
  ).toString();
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      data,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authBuffer}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching tokens from Spotify:", error);
    throw new AppError("failed to get tokens from spotify", 500);
  }
};
//recuperation des données de l'utilisateur spotify
const getSpotifyProfile = async (accessToken: string) => {
  try {
    const response = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { spotifyId: response.data.id, email: response.data.email };
  } catch (error) {
    console.error("Error fetching Spotify profile:", error);
    throw new AppError("failed to get Spotify profile", 500);
  }
};

// recuperation playlist
const getUserPlaylist = async (
  accessToken: string,
): Promise<SpotifyPlaylist[]> => {
  try {
    const response = await axios.get(
      "https://api.spotify.com/v1/me/playlists",
      {
        headers: { Authorization: `Bearer${accessToken}` },
      },
    );
    return response.data.items.map((item: any) => {
      id: item.id;
      name: item.name;
      imageUrl: item.images.length > 0 ? item.images[0].url : null;
    });
  } catch (error) {
    console.log("erreur de recuperation des playlist", error);
    throw new AppError("Erreur de recuperation des playlist", 500);
  }
};
//recuperation des titres de la playlist
const getPlaylistTrack = async (
  accessToken: string,
  playlistId: string,
): Promise<SpotifyTrack[]> => {
  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const validTracks: SpotifyTrack[] = [];

    response.data.items.array.forEach((item: any) => {
      const track = item.track;
      if (track && track.preview_url) {
        validTracks.push({
          id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          previewUrl: track.preview_url,
        });
      }
    });
    return validTracks;
  } catch (error) {
    console.log("Erreur de recuperation des tracks");
    throw new AppError(
      "Impossible de recuperer les tracks de la playlist",
      500,
    );
  }
};
export default {
  getSpotifyAuthUrl,
  getTokens,
  getSpotifyProfile,
  getPlaylistTrack,
  getUserPlaylist,
};
