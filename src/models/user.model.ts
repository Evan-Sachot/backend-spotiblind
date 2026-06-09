import pool from "../config/database.js";

const findSpotifyId = async (spotifyId: string) => {
  const query = "SELECT* FROM users WHERE spotify_id = ?";
  const [rows] = await pool.execute(query, [spotifyId]);
  const user = rows as any;
  return user.length > 0 ? user[0] : null;
};
export default { findSpotifyId };
