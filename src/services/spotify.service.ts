import axios from "axios";
import AppError from "../errors/appError.js";
import {
  SpotifyAuthResponse,
  SpotifyTokenBodyParams,
  SpotifyPlaylist,
  SpotifyTrack,
} from "../types/spotify.js";
import { decrypt } from "../utils/crypto.util.js";
import userModel from "../models/user.model.js";
import { error } from "node:console";
import { title } from "node:process";

const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "";

const authBuffer = Buffer.from(`${clientId}:${clientSecret}`).toString(
  "base64",
); // Encodage en base64 de l'identifiant et du secret pour l'authentification spotify

const spotifyApi = axios.create({
  baseURL: "https://api.spotify.com/v1",
});

spotifyApi.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const userId = Number(originalRequest.headers["x-user-id"]);

        const tokens = await userModel.getSpotifyToken(userId);

        if (!tokens) throw new AppError("Utilisateur introuvable", 404);

        const decryptedRefresh = decrypt(tokens.refresh_token);

        const refreshData = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: decryptedRefresh,
        }).toString();
        const refreshResponse = await axios.post(
          "https://accounts.spotify.com/api/token",
          refreshData,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${authBuffer}`,
            },
          },
        );
        const newAccessToken = refreshResponse.data.access_token;
        const newRefreshToken =
          refreshResponse.data.refresh_token || decryptedRefresh;

        const expireAt = new Date();
        expireAt.setSeconds(
          expireAt.getSeconds() + refreshResponse.data.expires_in,
        );

        await userModel.updateToken(userId, {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expire_at: expireAt,
        });
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

        return spotifyApi(originalRequest);
      } catch (refreshError) {
        console.error("Echec du rafraîchissement tokens", refreshError);
        throw new AppError("Session Spotify expirée", 401);
      }
    }
    return Promise.reject(error);
  },
);

const getSpotifyAuthUrl = (): string => {
  const scope =  "user-read-private user-read-email playlist-read-private playlist-read-collaborative";
  const authQuery: SpotifyAuthResponse = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
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
  const tokenBody: SpotifyTokenBodyParams = {
    code,
    redirect_uri: REDIRECT_URI,
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
  userId: number,
  accessToken: string,
): Promise<SpotifyPlaylist[]> => {
  try {
    const response = await spotifyApi.get("/me/playlists", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-user-id": userId.toString(),
      },
    });
    return response.data.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      imageUrl: item.images?.[0]?.url ?? "",
    }));
  } catch (error) {
    console.log("erreur de recuperation des playlist", error);
    throw new AppError("Erreur de recuperation des playlist", 500);
  }
};
//recuperation des titres de la playlist
const getPlaylistTrack = async (
  userId: number,
  accessToken: string,
  playlistId: string,
) => {
  try {
    const PAGE_SIZE = 100;
    const MAX_ITEMS = 500;
    const allEntries: any[] = [];
    let offset = 0;
    let hasNextPage = true;

    while (hasNextPage && offset < MAX_ITEMS) {
      const response = await spotifyApi.get(
        `/playlists/${playlistId}/items`,
        {
          params: { limit: PAGE_SIZE, offset },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-user-id": userId.toString(),
          },
        },
      );

      allEntries.push(...(response.data.items ?? []));
      hasNextPage = Boolean(response.data.next);
      offset += PAGE_SIZE;
    }

    console.log(
      `Playlist ${playlistId} : ${allEntries.length} entrées récupérées (pagination)`,
    );

    const playableTracks = allEntries
      .filter(
        (entry: any) =>
          entry.item && entry.item.id && entry.item.type !== "episode",
      )
      .map((entry: any) => ({
        id: entry.item.id,
        title: entry.item.name,
        artist: entry.item.artists?.[0]?.name ?? "Artiste inconnu",
        imageUrl: entry.item.album?.images?.[0]?.url ?? "",
        previewUrl: entry.item.preview_url ?? "",
      }));

    console.log(
      `Playlist ${playlistId} : ${playableTracks.length}/${allEntries.length} pistes exploitables`,
    );

    return playableTracks;
  } catch (error: any) {
    console.error(
      "Erreur récupération items :",
      error.response?.status,
      error.response?.data ?? error,
    );
    throw new AppError("Impossible de récupérer les titres de la playlist", 500);
  }
};
// AUTOCOMPLÉTION DE TITRES
const searchTracks = async (
  userId: number,
  accessToken: string,
  query: string,
  limit: number = 5,
) => {
  try {
    const response = await spotifyApi.get("/search", {
      params: {
        q: query,
        type: "track",
        limit: limit,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-user-id": userId.toString(),
      },
    });
    return response.data.tracks.items.map((track: any) => ({
      id: track.id,
      title: track.name,
      artist: track.artists[0].name,
      imageUrl:
        track.album.images.length > 0 ? track.album.images[0].url : null,
    }));
  } catch (error) {
    console.error("Erreur lors de la recherche Spotify:", error);
    throw new AppError("Erreur de recherche de musiques", 500);
  }
};
export default {
  getSpotifyAuthUrl,
  getTokens,
  getSpotifyProfile,
  getPlaylistTrack,
  getUserPlaylist,
  searchTracks,
};
