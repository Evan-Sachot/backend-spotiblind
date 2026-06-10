import { Jwt } from "jsonwebtoken";
import { Socket } from "socket.io";

export interface JwtUserPayload {
  id: number;
  username: string;
}

export interface CustomSocketData {
  user: JwtUserPayload;
}

export type AuthenticateSocket = Socket<any, any, any, CustomSocketData>;
