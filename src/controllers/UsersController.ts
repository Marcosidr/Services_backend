import type { Request, Response } from "express";
import { Category, User } from "../models";
import { isValidCep, normalizeCep } from "../utils/cep";
import { isValidCpf, normalizeCpf } from "../utils/cpf";
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
  cpf?: string;
  phone?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
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
    cpf: user.cpf,
    phone: user.phone,
    cep: user.cep,
    endereco: user.endereco,
    numero: user.numero,
    complemento: user.complemento,
    bairro: user.bairro,
    cidade: user.cidade,
    uf: user.uf,
    estado: user.estado,
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

function normalizeOptionalText(value: string | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export class UsersController {
  static async index(req: Request, res: Response) {
    const users = await User.findAll({
      order: [["createdAt", "DESC"]],
      attributes: [
        "id",
        "name",
        "email",
        "cpf",
        "phone",
        "cep",
        "endereco",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "uf",
        "estado",
        "role",
        "createdAt",
        "updatedAt"
      ],
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
      attributes: [
        "id",
        "name",
        "email",
        "cpf",
        "phone",
        "cep",
        "endereco",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "uf",
        "estado",
        "role",
        "createdAt",
        "updatedAt"
      ],
      include: categoriesInclude()
    });
    if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

    return res.json(sanitizeUser(user));
  }

  static async store(req: Request, res: Response) {
    const {
      name,
      email,
      cpf,
      phone,
      cep,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      estado,
      password,
      role,
      categoryId,
      categoryIds
    } = req.body as UserPayload;

    if (typeof categoryId !== "undefined" || typeof categoryIds !== "undefined") {
      return res.status(400).json({
        message: "Categorias so podem ser definidas no cadastro de profissional"
      });
    }

    if (!name || !email || !cpf || !password) {
      return res.status(400).json({
        message: "name, email, cpf e password sao obrigatorios"
      });
    }

    const emailValidationError = getEmailValidationError(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    const passwordValidationError = getPasswordValidationError(password);
    if (passwordValidationError) {
      return res.status(400).json({ message: passwordValidationError });
    }

    const normalizedCpf = normalizeCpf(cpf);
    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ message: "CPF invalido" });
    }

    if (typeof cep === "string" && cep.trim()) {
      const normalizedCep = normalizeCep(cep);
      if (!isValidCep(normalizedCep)) {
        return res.status(400).json({ message: "CEP invalido" });
      }
    }

    if (typeof uf === "string" && uf.trim() && !/^[a-zA-Z]{2}$/.test(uf.trim())) {
      return res.status(400).json({ message: "UF invalida" });
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
    const cpfExists = await User.findOne({ where: { cpf: normalizedCpf } });
    if (cpfExists) return res.status(409).json({ message: "CPF ja cadastrado" });

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      cpf: normalizedCpf,
      phone: typeof phone === "string" && phone.trim() ? normalizePhone(phone) : null,
      cep: typeof cep === "string" && cep.trim() ? normalizeCep(cep) : null,
      endereco: normalizeOptionalText(endereco),
      numero: normalizeOptionalText(numero),
      complemento: normalizeOptionalText(complemento),
      bairro: normalizeOptionalText(bairro),
      cidade: normalizeOptionalText(cidade),
      uf: typeof uf === "string" && uf.trim() ? uf.trim().toUpperCase() : null,
      estado: normalizeOptionalText(estado),
      password: hashPassword(password),
      role: role ?? "user"
    });

    const savedUser = await User.findByPk(user.id, {
      attributes: [
        "id",
        "name",
        "email",
        "cpf",
        "phone",
        "cep",
        "endereco",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "uf",
        "estado",
        "role",
        "createdAt",
        "updatedAt"
      ],
      include: categoriesInclude()
    });

    return res.status(201).json(savedUser ? sanitizeUser(savedUser) : sanitizeUser(user));
  }

  static async update(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id invalido" });
    const id = parseUserId(idParam);
    if (id === null) return res.status(400).json({ message: "id invalido" });

    const { name, email, cpf, phone, cep, endereco, numero, complemento, bairro, cidade, uf, estado, password, role } =
      req.body as UserPayload;

    if (hasCategoryPayload(req.body as UserPayload)) {
      return res.status(400).json({
        message: "Categorias so podem ser definidas no cadastro de profissional"
      });
    }

    if (typeof email !== "undefined" || typeof cpf !== "undefined") {
      return res.status(400).json({ message: "Nao e permitido alterar email ou cpf" });
    }

    if (
      !name &&
      typeof phone === "undefined" &&
      typeof cep === "undefined" &&
      typeof endereco === "undefined" &&
      typeof numero === "undefined" &&
      typeof complemento === "undefined" &&
      typeof bairro === "undefined" &&
      typeof cidade === "undefined" &&
      typeof uf === "undefined" &&
      typeof estado === "undefined" &&
      !password &&
      !role
    ) {
      return res.status(400).json({ message: "Informe ao menos um campo para atualizar" });
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

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

    if (typeof cep === "string" && cep.trim()) {
      if (!isValidCep(cep)) {
        return res.status(400).json({ message: "CEP invalido" });
      }
    }

    if (typeof uf === "string" && uf.trim() && !/^[a-zA-Z]{2}$/.test(uf.trim())) {
      return res.status(400).json({ message: "UF invalida" });
    }

    if (role && role !== "user" && role !== "professional" && role !== "admin") {
      return res.status(400).json({ message: "role invalida" });
    }

    await user.update({
      ...(name ? { name: name.trim() } : {}),
      ...(typeof phone !== "undefined"
        ? {
            phone:
              typeof phone === "string" && phone.trim()
                ? normalizePhone(phone)
                : null
          }
        : {}),
      ...(typeof cep !== "undefined"
        ? {
            cep: typeof cep === "string" && cep.trim() ? normalizeCep(cep) : null
          }
        : {}),
      ...(typeof endereco !== "undefined"
        ? {
            endereco: normalizeOptionalText(endereco)
          }
        : {}),
      ...(typeof numero !== "undefined"
        ? {
            numero: normalizeOptionalText(numero)
          }
        : {}),
      ...(typeof complemento !== "undefined"
        ? {
            complemento: normalizeOptionalText(complemento)
          }
        : {}),
      ...(typeof bairro !== "undefined"
        ? {
            bairro: normalizeOptionalText(bairro)
          }
        : {}),
      ...(typeof cidade !== "undefined"
        ? {
            cidade: normalizeOptionalText(cidade)
          }
        : {}),
      ...(typeof uf !== "undefined"
        ? {
            uf: typeof uf === "string" && uf.trim() ? uf.trim().toUpperCase() : null
          }
        : {}),
      ...(typeof estado !== "undefined"
        ? {
            estado: normalizeOptionalText(estado)
          }
        : {}),
      ...(password ? { password: hashPassword(password) } : {}),
      ...(role ? { role } : {})
    });

    const savedUser = await User.findByPk(id, {
      attributes: [
        "id",
        "name",
        "email",
        "cpf",
        "phone",
        "cep",
        "endereco",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "uf",
        "estado",
        "role",
        "createdAt",
        "updatedAt"
      ],
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
