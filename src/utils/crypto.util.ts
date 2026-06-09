import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ALGORITHM = "aes-256-cbc";

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || "", "utf-8"); //transformation de la clé d'encryption en buffer

const IV_LENGTH = 16; // Longueur de l'IV 16 octets pour AES

export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH); // Génération d'un IV aléatoire

  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv); // Création du cipher avec l'algorithme, la clé et l'IV
  let encrypted = cipher.update(text, "utf-8", "hex"); // Chiffrement du texte
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted; // retourn l'iv et le texte chiffré
};

export const decrypt = (text: string): string => {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts[0], "hex"); //Récupération de l'iv
  const encryptedText = textParts[1];

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf-8"); //Déchiffrement du texte
  decrypted += decipher.final("utf-8"); //retourne le texte déchiffré
  return decrypted;
};
