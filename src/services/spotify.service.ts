import axios from "axios";
import AppError from "../errors/appError.js";
import {
  SpotifyAuthResponse,
  SpotifyTokenBodyParams,
} from "../types/spotify.js";

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
export default { getSpotifyAuthUrl, getTokens, getSpotifyProfile };
