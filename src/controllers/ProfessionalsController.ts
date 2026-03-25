import type { Request, Response } from "express";
import { Op, Transaction } from "sequelize";
import { Category, Professional, User, UserCategory } from "../models";
import { isValidCpf, normalizeCpf } from "../utils/cpf";
import { getEmailValidationError, normalizeEmail } from "../utils/email";
import { getPhoneValidationError, normalizePhone } from "../utils/phone";

type RegisterProfessionalBody = {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  description?: string;
  experience?: string;
  price?: string | number;
  priceUnit?: string;
  area?: string | number;
  cep?: string;
  city?: string;
  online?: boolean | string;
  categoryIds?: unknown;
  categoryId?: unknown;
  "categoryIds[]"?: unknown;
};

type UpgradeProfessionalBody = {
  userId?: unknown;
  cpf?: string;
  description?: string;
  experience?: string;
  price?: string | number;
  priceUnit?: string;
  area?: string | number;
  cep?: string;
  city?: string;
  online?: boolean | string;
  categoryIds?: unknown;
  categoryId?: unknown;
  "categoryIds[]"?: unknown;
};

function parseUserId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parseProfessionalId(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return id;
}

function parseCategoryIds(input: unknown): number[] | null {
  if (typeof input === "undefined" || input === null) return [];

  let rawList: unknown[] = [];

  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();

    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        rawList = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return null;
      }
    } else if (trimmed.includes(",")) {
      rawList = trimmed.split(",").map((item) => item.trim());
    } else {
      rawList = [trimmed];
    }
  } else {
    rawList = [input];
  }

  const parsedIds: number[] = [];

  for (const rawItem of rawList) {
    const normalized =
      typeof rawItem === "number"
        ? rawItem
        : typeof rawItem === "string" && /^\d+$/.test(rawItem.trim())
        ? Number(rawItem.trim())
        : NaN;

    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
      return null;
    }

    parsedIds.push(normalized);
  }

  return Array.from(new Set(parsedIds));
}

function parseOptionalNumber(value: unknown) {
  if (typeof value === "undefined" || value === null || value === "") return null;

  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function parseOnlineFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "sim";
  }

  return false;
}

function categoriesInclude() {
  return [
    {
      association: "categories",
      attributes: ["id", "slug", "label", "icon", "is_active"],
      through: { attributes: [] }
    },
    {
      association: "professional",
      attributes: [
        "id",
        "cpf",
        "description",
        "experience",
        "price",
        "priceUnit",
        "areaKm",
        "cep",
        "city",
        "online",
        "verified",
        "approvalStatus",
        "photoUrl"
      ]
    }
  ];
}

function sanitizeProfessional(user: User) {
  const categories = (user.get("categories") as Category[] | undefined) ?? [];
  const professional = user.get("professional") as Professional | undefined;

  const categoryLabels = categories.map((category) => category.label);

  return {
    id: String(user.id),
    name: user.name,
    photo: professional?.photoUrl ?? "",
    online: Boolean(professional?.online),
    verified: Boolean(professional?.verified),
    categoryLabel: categoryLabels.join(" / "),
    rating: 0,
    reviews: 0,
    city: professional?.city ?? "",
    distance: 0,
    completedJobs: 0,
    area: professional?.areaKm ?? 10,
    description: professional?.description ?? "",
    tags: categoryLabels,
    price: Number(professional?.price ?? 0),
    priceUnit: professional?.priceUnit ?? "servico",
    phone: user.phone ?? "",
    reviewList: []
  };
}

async function categoriesAreValid(categoryIds: number[]) {
  const categoriesCount = await Category.count({
    where: {
      id: {
        [Op.in]: categoryIds
      },
      is_active: true
    }
  });

  return categoriesCount === categoryIds.length;
}

async function saveProfessionalData(
  user: User,
  professionalBody: {
    cpf: string;
    description: string;
    experience?: string;
    price?: string | number;
    priceUnit?: string;
    area?: string | number;
    cep?: string;
    city?: string;
    online?: boolean | string;
  },
  categoryIds: number[],
  transaction: Transaction
) {
  const parsedPrice = parseOptionalNumber(professionalBody.price);
  const parsedArea = parseOptionalNumber(professionalBody.area);

  await Professional.create(
    {
      userId: user.id,
      cpf: professionalBody.cpf,
      description: professionalBody.description.trim(),
      experience: professionalBody.experience?.trim() || null,
      price: parsedPrice,
      priceUnit: professionalBody.priceUnit?.trim() || "servico",
      areaKm: parsedArea && parsedArea > 0 ? Math.round(parsedArea) : 10,
      cep: professionalBody.cep?.trim() || null,
      city: professionalBody.city?.trim() || null,
      online: parseOnlineFlag(professionalBody.online),
      verified: false,
      approvalStatus: "pending",
      photoUrl: null
    },
    { transaction }
  );

  await UserCategory.bulkCreate(
    categoryIds.map((currentCategoryId) => ({
      userId: user.id,
      categoryId: currentCategoryId
    })),
    { transaction, ignoreDuplicates: true }
  );
}

export class ProfessionalsController {
  static async register(req: Request, res: Response) {
    const {
      name,
      email,
      phone,
      cpf,
      description,
      experience,
      price,
      priceUnit,
      area,
      cep,
      city,
      online,
      categoryIds,
      categoryId
    } = req.body as RegisterProfessionalBody;

    const parsedCategoryIds =
      parseCategoryIds(
        typeof categoryIds !== "undefined"
          ? categoryIds
          : typeof req.body["categoryIds[]"] !== "undefined"
          ? req.body["categoryIds[]"]
          : categoryId
      ) ?? null;

    if (!email || !cpf) {
      return res.status(400).json({
        message: "email e cpf sao obrigatorios"
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ message: "description e obrigatorio" });
    }

    const emailValidationError = getEmailValidationError(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    if (parsedCategoryIds === null || parsedCategoryIds.length === 0) {
      return res.status(400).json({ message: "categoryIds invalido" });
    }

    if (!(await categoriesAreValid(parsedCategoryIds))) {
      return res.status(400).json({ message: "Uma ou mais categorias nao existem" });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedCpf = normalizeCpf(cpf);

    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ message: "CPF invalido" });
    }

    if (typeof phone !== "undefined") {
      const phoneValidationError = getPhoneValidationError(String(phone));
      if (phoneValidationError) {
        return res.status(400).json({ message: phoneValidationError });
      }
    }

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    const existingProfessionalByCpf = await Professional.findOne({ where: { cpf: normalizedCpf } });

    if (existingProfessionalByCpf && existingProfessionalByCpf.userId !== existingUser?.id) {
      return res.status(409).json({ message: "CPF ja cadastrado por outro profissional" });
    }

    if (existingUser?.role === "admin") {
      return res.status(403).json({ message: "Nao e permitido promover usuario admin para profissional" });
    }

    if (!existingUser && (!name || !phone)) {
      return res.status(400).json({
        message: "name e phone sao obrigatorios ao cadastrar profissional sem usuario previo"
      });
    }

    if (existingUser) {
      const existingProfessional = await Professional.findOne({ where: { userId: existingUser.id } });
      if (existingProfessional) {
        return res.status(409).json({ message: "Usuario ja possui cadastro profissional" });
      }
    }

    const createdUserId = await User.sequelize!.transaction(async (transaction: Transaction) => {
      let user = existingUser;

      if (!user) {
        user = await User.create(
          {
            name: name!.trim(),
            email: normalizedEmail,
            phone: normalizePhone(phone!),
            password: null,
            role: "professional"
          },
          { transaction }
        );
      } else {
        await user.update(
          {
            role: "professional",
            ...(name ? { name: name.trim() } : {}),
            ...(phone ? { phone: normalizePhone(phone) } : {})
          },
          { transaction }
        );
      }

      await saveProfessionalData(
        user,
        {
          cpf: normalizedCpf,
          description,
          experience,
          price,
          priceUnit,
          area,
          cep,
          city,
          online
        },
        parsedCategoryIds,
        transaction
      );

      return user.id;
    });

    const savedUser = await User.findByPk(createdUserId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!savedUser) {
      return res.status(500).json({ message: "Falha ao carregar profissional criado" });
    }

    return res.status(201).json({
      message: "Cadastro de profissional enviado com sucesso",
      professional: sanitizeProfessional(savedUser)
    });
  }

  static async upgradeFromUser(req: Request, res: Response) {
    const {
      userId,
      cpf,
      description,
      experience,
      price,
      priceUnit,
      area,
      cep,
      city,
      online,
      categoryIds,
      categoryId
    } = req.body as UpgradeProfessionalBody;

    const parsedUserId = parseUserId(userId);
    if (!parsedUserId) {
      return res.status(400).json({ message: "userId invalido" });
    }

    if (!cpf || !description || !description.trim()) {
      return res.status(400).json({ message: "cpf e description sao obrigatorios" });
    }

    const parsedCategoryIds =
      parseCategoryIds(
        typeof categoryIds !== "undefined"
          ? categoryIds
          : typeof req.body["categoryIds[]"] !== "undefined"
          ? req.body["categoryIds[]"]
          : categoryId
      ) ?? null;

    if (parsedCategoryIds === null || parsedCategoryIds.length === 0) {
      return res.status(400).json({ message: "categoryIds invalido" });
    }

    if (!(await categoriesAreValid(parsedCategoryIds))) {
      return res.status(400).json({ message: "Uma ou mais categorias nao existem" });
    }

    const normalizedCpf = normalizeCpf(cpf);
    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ message: "CPF invalido" });
    }

    const user = await User.findByPk(parsedUserId);
    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Nao e permitido promover usuario admin para profissional" });
    }

    const existingProfessional = await Professional.findOne({ where: { userId: parsedUserId } });
    if (existingProfessional) {
      return res.status(409).json({ message: "Usuario ja possui cadastro profissional" });
    }

    const existingProfessionalByCpf = await Professional.findOne({ where: { cpf: normalizedCpf } });
    if (existingProfessionalByCpf) {
      return res.status(409).json({ message: "CPF ja cadastrado por outro profissional" });
    }

    await User.sequelize!.transaction(async (transaction: Transaction) => {
      await user.update({ role: "professional" }, { transaction });

      await saveProfessionalData(
        user,
        {
          cpf: normalizedCpf,
          description,
          experience,
          price,
          priceUnit,
          area,
          cep,
          city,
          online
        },
        parsedCategoryIds,
        transaction
      );
    });

    const savedUser = await User.findByPk(parsedUserId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!savedUser) {
      return res.status(500).json({ message: "Falha ao carregar profissional criado" });
    }

    return res.status(201).json({
      message: "Usuario promovido para profissional com sucesso",
      professional: sanitizeProfessional(savedUser)
    });
  }

  static async show(req: Request, res: Response) {
    const professionalId = parseProfessionalId(req.params.id);
    if (!professionalId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const professional = await User.findByPk(professionalId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!professional || !professional.get("professional")) {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    return res.json(sanitizeProfessional(professional));
  }
}
