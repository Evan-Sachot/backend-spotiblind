export type SpotifyAuthResponse = {
  response_type: string;
  client_id: string;
  scope: string;
  redirect_uri: string;
};
export type SpotifyTokenBodyParams = {
  code: string;
  redirect_uri: string;
  grant_type: "authorization_code";
};

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
}
