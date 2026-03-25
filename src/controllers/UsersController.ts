import type { Request, Response } from "express";
import { Category, User } from "../models";
import { getEmailValidationError, normalizeEmail } from "../utils/email";
import { getPasswordValidationError, hashPassword } from "../utils/password";
import { getPhoneValidationError, normalizePhone } from "../utils/phone";

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
  categoryId?: number | string;
  categoryIds?: Array<number | string>;
};

function categoriesInclude() {
  return [
    {
      association: "categories",
      attributes: ["id", "slug", "label", "icon", "is_active"],
      through: { attributes: [] }
    }
  ];
}

function sanitizeUser(user: User) {
  const userCategories = (user.get("categories") as Category[] | undefined) ?? [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    categories: userCategories.map((category) => ({
      id: category.id,
      slug: category.slug,
      label: category.label,
      icon: category.icon,
      is_active: category.is_active
    })),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function hasCategoryPayload(payload: UserPayload) {
  return typeof payload.categoryId !== "undefined" || typeof payload.categoryIds !== "undefined";
}

export class UsersController {
  static async index(req: Request, res: Response) {
    const users = await User.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });
    return res.json(users.map(sanitizeUser));
  }

  static async show(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id invalido" });
    const id = parseUserId(idParam);
    if (id === null) return res.status(400).json({ message: "id invalido" });

    const user = await User.findByPk(id, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });
    if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

    return res.json(sanitizeUser(user));
  }

  static async store(req: Request, res: Response) {
    const { name, email, phone, password, role, categoryId, categoryIds } = req.body as UserPayload;

    if (typeof categoryId !== "undefined" || typeof categoryIds !== "undefined") {
      return res.status(400).json({
        message: "Categorias so podem ser definidas no cadastro de profissional"
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email e password sao obrigatorios" });
    }

    const emailValidationError = getEmailValidationError(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    const passwordValidationError = getPasswordValidationError(password);
    if (passwordValidationError) {
      return res.status(400).json({ message: passwordValidationError });
    }

    if (typeof phone === "string" && phone.trim()) {
      const phoneValidationError = getPhoneValidationError(phone);
      if (phoneValidationError) {
        return res.status(400).json({ message: phoneValidationError });
      }
    }

    if (role && role !== "user" && role !== "professional" && role !== "admin") {
      return res.status(400).json({ message: "role invalida" });
    }

    const normalizedEmail = normalizeEmail(email);
    const exists = await User.findOne({ where: { email: normalizedEmail } });
    if (exists) return res.status(409).json({ message: "Email ja cadastrado" });

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: typeof phone === "string" && phone.trim() ? normalizePhone(phone) : null,
      password: hashPassword(password),
      role: role ?? "user"
    });

    const savedUser = await User.findByPk(user.id, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    return res.status(201).json(savedUser ? sanitizeUser(savedUser) : sanitizeUser(user));
  }

  static async update(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id invalido" });
    const id = parseUserId(idParam);
    if (id === null) return res.status(400).json({ message: "id invalido" });

    const { name, email, phone, password, role } = req.body as UserPayload;

    if (hasCategoryPayload(req.body as UserPayload)) {
      return res.status(400).json({
        message: "Categorias so podem ser definidas no cadastro de profissional"
      });
    }

    if (!name && !email && typeof phone === "undefined" && !password && !role) {
      return res.status(400).json({ message: "Informe ao menos um campo para atualizar" });
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

    if (email && email !== user.email) {
      const emailValidationError = getEmailValidationError(email);
      if (emailValidationError) {
        return res.status(400).json({ message: emailValidationError });
      }

      const normalizedEmail = normalizeEmail(email);
      const exists = await User.findOne({ where: { email: normalizedEmail } });
      if (exists) return res.status(409).json({ message: "Email ja cadastrado" });
    }

    if (password) {
      const passwordValidationError = getPasswordValidationError(password);
      if (passwordValidationError) {
        return res.status(400).json({ message: passwordValidationError });
      }
    }

    if (typeof phone === "string" && phone.trim()) {
      const phoneValidationError = getPhoneValidationError(phone);
      if (phoneValidationError) {
        return res.status(400).json({ message: phoneValidationError });
      }
    }

    if (role && role !== "user" && role !== "professional" && role !== "admin") {
      return res.status(400).json({ message: "role invalida" });
    }

    await user.update({
      ...(name ? { name: name.trim() } : {}),
      ...(email ? { email: normalizeEmail(email) } : {}),
      ...(typeof phone !== "undefined"
        ? {
            phone:
              typeof phone === "string" && phone.trim()
                ? normalizePhone(phone)
                : null
          }
        : {}),
      ...(password ? { password: hashPassword(password) } : {}),
      ...(role ? { role } : {})
    });

    const savedUser = await User.findByPk(id, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    return res.json(savedUser ? sanitizeUser(savedUser) : sanitizeUser(user));
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
