import type { Request, Response } from "express";
import { Op, Transaction } from "sequelize";
import { Category, ProfessionalProfile, User, UserCategory } from "../models";

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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
      association: "professionalProfile",
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
  const profile = user.get("professionalProfile") as ProfessionalProfile | undefined;

  const categoryLabels = categories.map((category) => category.label);

  return {
    id: String(user.id),
    name: user.name,
    photo: profile?.photoUrl ?? "",
    online: Boolean(profile?.online),
    verified: Boolean(profile?.verified),
    categoryLabel: categoryLabels.join(" / "),
    rating: 0,
    reviews: 0,
    city: profile?.city ?? "",
    distance: 0,
    completedJobs: 0,
    area: profile?.areaKm ?? 10,
    description: profile?.description ?? "",
    tags: categoryLabels,
    price: Number(profile?.price ?? 0),
    priceUnit: profile?.priceUnit ?? "servico",
    phone: user.phone ?? "",
    reviewList: []
  };
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

    if (!name || !email || !phone || !cpf) {
      return res.status(400).json({
        message: "name, email, phone e cpf sao obrigatorios"
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ message: "description e obrigatorio" });
    }

    if (parsedCategoryIds === null || parsedCategoryIds.length === 0) {
      return res.status(400).json({ message: "categoryIds invalido" });
    }

    const categoriesCount = await Category.count({
      where: {
        id: {
          [Op.in]: parsedCategoryIds
        },
        is_active: true
      }
    });

    if (categoriesCount !== parsedCategoryIds.length) {
      return res.status(400).json({ message: "Uma ou mais categorias nao existem" });
    }

    const normalizedEmail = normalizeEmail(email);
    const exists = await User.findOne({ where: { email: normalizedEmail } });
    if (exists) {
      return res.status(409).json({ message: "Email ja cadastrado" });
    }

    const parsedPrice = parseOptionalNumber(price);
    const parsedArea = parseOptionalNumber(area);

    const createdUserId = await User.sequelize!.transaction(async (transaction: Transaction) => {
      const user = await User.create(
        {
          name: name.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
          password: null,
          role: "professional"
        },
        { transaction }
      );

      await ProfessionalProfile.create(
        {
          userId: user.id,
          cpf: cpf.trim(),
          description: description.trim(),
          experience: experience?.trim() || null,
          price: parsedPrice,
          priceUnit: priceUnit?.trim() || "servico",
          areaKm: parsedArea && parsedArea > 0 ? Math.round(parsedArea) : 10,
          cep: cep?.trim() || null,
          city: city?.trim() || null,
          online: parseOnlineFlag(online),
          verified: false,
          approvalStatus: "pending",
          photoUrl: null
        },
        { transaction }
      );

      await UserCategory.bulkCreate(
        parsedCategoryIds.map((currentCategoryId) => ({
          userId: user.id,
          categoryId: currentCategoryId
        })),
        { transaction }
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

  static async show(req: Request, res: Response) {
    const professionalId = parseProfessionalId(req.params.id);
    if (!professionalId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const professional = await User.findByPk(professionalId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!professional || !professional.get("professionalProfile")) {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    return res.json(sanitizeProfessional(professional));
  }
}
