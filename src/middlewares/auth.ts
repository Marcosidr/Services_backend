import type { NextFunction, Request, Response } from "express";
import { parseBearerAuthorization } from "../utils/token";

export function auth(req: Request, res: Response, next: NextFunction) {
  const payload = parseBearerAuthorization(req.header("authorization"));
  if (!payload) {
    return res.status(401).json({
      message: "Token invalido ou ausente"
    });
  }

  const parsedUserId = Number(payload.sub);
  if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(401).json({
      message: "Token invalido"
    });
  }

  req.user = {
    id: parsedUserId,
    sub: payload.sub,
    role: payload.role,
    ...(payload.email ? { email: payload.email } : {})
  };

  return next();
}
