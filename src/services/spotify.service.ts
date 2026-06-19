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


const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET||"";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI||"";

const authBuffer = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );   // Encodage en base64 de l'identifiant et du secret pour l'authentification spotify

const spotifyApi = axios.create({
  baseURL:"https://api.spotify.com/v1"
})

spotifyApi.interceptors.response.use(
  (response)=>{
    return response
  },
  async (error)=>{
    const originalRequest = error.config;
    if(error.response?.status === 401 ){
      originalRequest._retry = true
    try{
      const userId = Number(originalRequest.headers["x-user-id"])

      const tokens = await userModel.getSpotifyToken(userId);

      if(!tokens) throw new AppError("Utilisateur introuvable",404);

       const decryptedRefresh = decrypt(tokens.refresh_token);

      const refreshData = new URLSearchParams({
        grant_type:"refresh_token",
        refresh_token: decryptedRefresh,
      }).toString();
      const refreshResponse = await axios.post(
        "https://accounts.spotify.com/api/token",
        refreshData,
        {
          headers:{
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${authBuffer}`,
          }
        }
      );
      const newAccessToken = refreshResponse.data.access_token;
      const newRefreshToken= refreshResponse.data.refresh_token|| decryptedRefresh;

      const expireAt = new Date();
      expireAt.setSeconds(expireAt.getSeconds() + refreshResponse.data.expires_in);

      await userModel.updateToken(userId,{
        access_token:newAccessToken,
        refresh_token:newRefreshToken,
        expire_at:expireAt
      });
      originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

      return spotifyApi(originalRequest);
    }catch(refreshError){
      console.error("Echec du rafraîchissement tokens", refreshError);
      throw new AppError("Session Spotify expirée",401);
    }}
   return Promise.reject(error);
  }
)




const getSpotifyAuthUrl = (): string => {
  const scope = "user-read-private user-read-email";
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
  userId:number,
  accessToken: string,
): Promise<SpotifyPlaylist[]> => {
  try {
    const response = await spotifyApi.get("/me/playlists",{
      headers:{
        Authorization:`Bearer ${accessToken}`,
        "x-user-id":userId.toString()
      }
    })
    return response.data.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      imageUrl: item.images.length > 0 ? item.images[0].url : null,
    }));
  } catch (error) {
    console.log("erreur de recuperation des playlist", error);
    throw new AppError("Erreur de recuperation des playlist", 500);
  }
};
//recuperation des titres de la playlist
const getPlaylistTrack = async (
  userId:number,
  accessToken: string,
  playlistId: string,
): Promise<SpotifyTrack[]> => {
  try {
    const response = await spotifyApi.get(`/playlists/${playlistId}/tracks`,{
      headers:{
        Authorization:`Bearer ${accessToken}`,
        "x-user-id":userId.toString()
      }
    })
    const validTracks: SpotifyTrack[] = [];

    response.data.items.forEach((item: any) => {
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
