import pool from "../config/database.js";

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
}) => {
  const query =
    "INSERT INTO users (spotify_id, email, username) VALUES (?,?,?)";
  const [result] = await pool.execute(query, [
    userData.spotifyId,
    userData.email,
    userData.username,
  ]);
  const insertId = (result as any).insertId;
  return { id: insertId, username: userData.username, email: userData.email };
};
const updateToken = async (
  userId: number,
  tokens: { access_token: string; refresh_token: string },
) => {
  const query =
    "UPDATE users SET access_token = ?, refresh_token = ? WHERE id = ?";
  await pool.execute(query, [
    tokens.access_token,
    tokens.refresh_token,
    userId,
  ]);
};

export default { findSpotifyId, createUser, updateToken };
