import pool from "../config/database.js";
import { encrypt } from "../utils/crypto.util.js";
import {
  User,
  CreateUserData,
  CreatedUserResult,
  UserTokens,
} from "../types/user.type.js";
const findSpotifyId = async (spotifyId: string): Promise<User | null> => {
  const query = "SELECT* FROM users WHERE spotify_id = ?";
  const [rows] = await pool.execute(query, [spotifyId]);
  const users = rows as User[];
  return users.length > 0 ? users[0] : null;
};
const createUser = async (
  userData: CreateUserData,
): Promise<CreatedUserResult> => {
  const encryptedRefreshToken = encrypt(userData.refresh_token);
  const query =
    "INSERT INTO users (spotify_id, email, username, access_token, refresh_token, expire_at) VALUES (?,?,?,?,?,?)";
  const [result] = await pool.execute(query, [
    userData.spotifyId,
    userData.email,
    userData.username,
    userData.access_token,
    encryptedRefreshToken,
    userData.expire_at,
  ]);
  const insertId = (result as any).insertId;
  return { id: insertId, username: userData.username, email: userData.email };
};
const updateToken = async (
  userId: number,
  tokens: UserTokens,
): Promise<void> => {
  const encryptedRefreshToken = encrypt(tokens.refresh_token);
  const query =
    "UPDATE users SET access_token = ?, refresh_token = ?, expire_at = ? WHERE id = ?";
  await pool.execute(query, [
    tokens.access_token,
    encryptedRefreshToken,
    tokens.expire_at,
    userId,
  ]);
};
const updateUsername = async (
  userId: number,
  username: string,
): Promise<void> => {
  const query = "UPDATE users SET username = ? WHERE id =?";
  await pool.execute(query, [username, userId]);
};

export default { findSpotifyId, createUser, updateToken, updateUsername };
