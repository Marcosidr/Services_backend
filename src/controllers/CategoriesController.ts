import type { Request, Response } from "express";
import { Category } from "../models";

type CategoryPayload = {
  slug?: string;
  label?: string;
  icon?: string | null;
  is_active?: boolean;
};

function parseCategoryId(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeCategoryLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeCategorySlug(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();

  return normalized || null;
}

function sanitizeCategory(category: Category) {
  return {
    id: category.id,
    slug: category.slug,
    label: category.label,
    icon: category.icon,
    is_active: category.is_active,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
}

export class CategoryController {
  static async index(req: Request, res: Response) {
    const categories = await Category.findAll({
      where: { is_active: true },
      order: [["label", "ASC"]],
      attributes: ["id", "slug", "label", "icon", "is_active", "createdAt", "updatedAt"]
    });

    return res.json(categories.map(sanitizeCategory));
  }

  static async adminIndex(req: Request, res: Response) {
    const categories = await Category.findAll({
      order: [["label", "ASC"]],
      attributes: ["id", "slug", "label", "icon", "is_active", "createdAt", "updatedAt"]
    });

    return res.json(categories.map(sanitizeCategory));
  }

  static async store(req: Request<unknown, unknown, CategoryPayload>, res: Response) {
    const { slug, label, icon, is_active } = req.body;

    const normalizedLabel = normalizeCategoryLabel(label);
    if (!normalizedLabel) {
      return res.status(400).json({ message: "label e obrigatorio" });
    }

    const normalizedSlug = normalizeCategorySlug(
      typeof slug === "string" && slug.trim() ? slug : normalizedLabel
    );
    if (!normalizedSlug) {
      return res.status(400).json({ message: "slug invalido" });
    }

    const existingSlug = await Category.findOne({ where: { slug: normalizedSlug } });
    if (existingSlug) {
      return res.status(409).json({ message: "slug ja cadastrado" });
    }

    const existingLabel = await Category.findOne({ where: { label: normalizedLabel } });
    if (existingLabel) {
      return res.status(409).json({ message: "label ja cadastrado" });
    }

    const createdCategory = await Category.create({
      slug: normalizedSlug,
      label: normalizedLabel,
      icon: normalizeOptionalText(icon),
      is_active: typeof is_active === "boolean" ? is_active : true
    });

    return res.status(201).json(sanitizeCategory(createdCategory));
  }

  static async update(
    req: Request<{ id: string }, unknown, CategoryPayload>,
    res: Response
  ) {
    const categoryId = parseCategoryId(req.params.id);
    if (!categoryId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Categoria nao encontrada" });
    }

    const { slug, label, icon, is_active } = req.body;
    if (
      typeof slug === "undefined" &&
      typeof label === "undefined" &&
      typeof icon === "undefined" &&
      typeof is_active === "undefined"
    ) {
      return res.status(400).json({ message: "Informe ao menos um campo para atualizar" });
    }

    const nextLabel =
      typeof label === "undefined" ? category.label : normalizeCategoryLabel(label);
    if (!nextLabel) {
      return res.status(400).json({ message: "label invalido" });
    }

    const slugSource =
      typeof slug === "undefined" ? category.slug : typeof slug === "string" ? slug : "";
    const nextSlug = normalizeCategorySlug(slugSource);
    if (!nextSlug) {
      return res.status(400).json({ message: "slug invalido" });
    }

    if (nextSlug !== category.slug) {
      const existingSlug = await Category.findOne({ where: { slug: nextSlug } });
      if (existingSlug && existingSlug.id !== category.id) {
        return res.status(409).json({ message: "slug ja cadastrado" });
      }
    }

    if (nextLabel !== category.label) {
      const existingLabel = await Category.findOne({ where: { label: nextLabel } });
      if (existingLabel && existingLabel.id !== category.id) {
        return res.status(409).json({ message: "label ja cadastrado" });
      }
    }

    await category.update({
      slug: nextSlug,
      label: nextLabel,
      ...(typeof icon !== "undefined" ? { icon: normalizeOptionalText(icon) } : {}),
      ...(typeof is_active === "boolean" ? { is_active } : {})
    });

    return res.json(sanitizeCategory(category));
  }

  static async destroy(req: Request<{ id: string }>, res: Response) {
    const categoryId = parseCategoryId(req.params.id);
    if (!categoryId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Categoria nao encontrada" });
    }

    await category.destroy();
    return res.status(204).send();
  }
}
