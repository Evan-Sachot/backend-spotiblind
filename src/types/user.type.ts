export interface User {
  id: number;
  spotify_id: string;
  email: string;
  username: string;
  access_token: string;
  refresh_token: string;
  expire_at: Date;
}
export interface CreateUserData {
  spotifyId: string;
  email: string;
  username: string;
  access_token: string;
  refresh_token: string;
  expire_at: Date;
}
export interface CreatedUserResult {
  id: number;
  username: string;
  email: string;
}
export interface UserTokens {
  access_token: string;
  refresh_token: string;
  expire_at: Date;
}
