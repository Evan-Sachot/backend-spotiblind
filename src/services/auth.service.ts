import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "fallback_secret";

const generateToken = (userId: number, username: string) => {
  const payload = { userId, username };
  return jwt.sign(payload, jwtSecret, { expiresIn: "1h" });
};

export default { generateToken };
