import type { NextFunction, Request, Response } from "express";

type UserRole = "user" | "professional" | "admin";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentRole = req.user?.role;

    if (!currentRole) {
      return res.status(401).json({ message: "Token invalido ou ausente" });
    }

    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({ message: "Acesso negado para este perfil" });
    }

    return next();
  };
}

export const requireAdmin = requireRole("admin");
