import pool from "../config/database.js";
import { encrypt } from "../utils/crypto.util.js";

const findSpotifyId = async (spotifyId: string) => {
  const query = "SELECT* FROM users WHERE spotify_id = ?";
  const [rows] = await pool.execute(query, [spotifyId]);
  const user = rows as any;
  return user.length > 0 ? user[0] : null;
};
const createUser = async (userData: {
  spotifyId: string;
  email: string;
  username: string;
  access_token: string;
  refresh_token: string;
  expire_at: Date;
}) => {
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
  tokens: { access_token: string; refresh_token: string; expire_at: Date },
) => {
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
