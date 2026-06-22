import { Response,NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../errors/appError.js";
import { AuthenticateRequest } from "../types/express.type.js";

const jwtSecret = process.env.JWT_SECRET || "fallback_secret";

export const verifyToken = (req: AuthenticateRequest, res:Response, next:NextFunction)=>{
 try{
    const authHeader = req.headers.authorization;
    if(!authHeader|| !authHeader.startsWith("Bearer ")){
        throw new AppError("Token manquant ou invalide", 401);
    }
    const token= authHeader.split(" ")[1];
    const decoded = jwt.verify(token,jwtSecret) as {id: number; username:string}
    req.user=decoded
    next()
 }catch(error){
    next(new AppError("Token expiré ou invalide",401));
 }
}