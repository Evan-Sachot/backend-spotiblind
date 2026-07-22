import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "fallback_secret";
const generateToken = (userId: number, username: string) => {
  return jwt.sign({ id:userId, username }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });
};

export default { generateToken };
