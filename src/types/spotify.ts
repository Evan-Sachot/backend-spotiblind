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
