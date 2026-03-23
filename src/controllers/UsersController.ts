import type { Request, Response } from "express";
import { User } from "../models";
import { hashPassword } from "../utils/password";

function parseUserId(value: string) {
  if (!/^\d+$/.test(value)) return null;

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return id;
}

type UserRole = "user" | "professional" | "admin";

type UserPayload = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone?: string) {
  if (typeof phone !== "string") return null;
  const normalized = phone.trim();
  return normalized.length > 0 ? normalized : null;
}

function sanitizeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export class UsersController {
  static async index(req: Request, res: Response) {
    const users = await User.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"]
    });
    return res.json(users.map(sanitizeUser));
  }

  static async show(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id invalido" });
    const id = parseUserId(idParam);
    if (id === null) return res.status(400).json({ message: "id invalido" });

    const user = await User.findByPk(id, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"]
    });
    if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

    return res.json(sanitizeUser(user));
  }

  static async store(req: Request, res: Response) {
    const { name, email, phone, password, role } = req.body as UserPayload;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email e password sao obrigatorios" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "password deve ter no minimo 6 caracteres" });
    }

    const normalizedEmail = normalizeEmail(email);
    const exists = await User.findOne({ where: { email: normalizedEmail } });
    if (exists) return res.status(409).json({ message: "Email ja cadastrado" });

    if (role && role !== "user" && role !== "professional" && role !== "admin") {
      return res.status(400).json({ message: "role invalida" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizePhone(phone),
      password: hashPassword(password),
      role: role ?? "user"
    });

    return res.status(201).json(sanitizeUser(user));
  }

  static async update(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id invalido" });
    const id = parseUserId(idParam);
    if (id === null) return res.status(400).json({ message: "id invalido" });

    const { name, email, phone, password, role } = req.body as UserPayload;
    if (!name && !email && typeof phone === "undefined" && !password && !role) {
      return res.status(400).json({ message: "Informe ao menos um campo para atualizar" });
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

    if (email && email !== user.email) {
      const normalizedEmail = normalizeEmail(email);
      const exists = await User.findOne({ where: { email: normalizedEmail } });
      if (exists) return res.status(409).json({ message: "Email ja cadastrado" });
      user.email = normalizedEmail;
    }

    if (password && password.length < 6) {
      return res.status(400).json({ message: "password deve ter no minimo 6 caracteres" });
    }

    if (role && role !== "user" && role !== "professional" && role !== "admin") {
      return res.status(400).json({ message: "role invalida" });
    }

    await user.update({
      ...(name ? { name: name.trim() } : {}),
      ...(email ? { email: normalizeEmail(email) } : {}),
      ...(typeof phone !== "undefined" ? { phone: normalizePhone(phone) } : {}),
      ...(password ? { password: hashPassword(password) } : {}),
      ...(role ? { role } : {})
    });

    return res.json(sanitizeUser(user));
  }

  static async destroy(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id invalido" });
    const id = parseUserId(idParam);
    if (id === null) return res.status(400).json({ message: "id invalido" });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

    await user.destroy();
    return res.status(204).send();
  }
}
