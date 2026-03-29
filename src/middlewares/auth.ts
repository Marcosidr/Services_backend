import type { NextFunction, Request, Response } from "express";
import { User } from "../models";
import { parseBearerAuthorization } from "../utils/token";

export async function auth(req: Request, res: Response, next: NextFunction) {
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
  const user = await User.findByPk(parsedUserId, {
    attributes: ["id", "email", "role"]
  });
  if (!user) {
    return res.status(401).json({
      message: "Usuario da sessao nao encontrado"
    });
  }

  req.user = {
    id: user.id,
    sub: payload.sub,
    role: user.role,
    ...(user.email ? { email: user.email } : {})
  };

  return next();
}
