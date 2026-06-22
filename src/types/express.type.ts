import { Request } from "express";
export interface AuthenticateRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}