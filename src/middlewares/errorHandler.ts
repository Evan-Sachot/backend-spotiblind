import AppError from "../errors/appError.js";
import { Request, Response, NextFunction } from "express";
const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ message: "Erreur serveur interne" });
};

export default errorHandler;
