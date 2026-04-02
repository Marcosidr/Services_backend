import type { Request, Response } from "express";
import { Category } from "../models";
import { paginateItems, parsePagination } from "../utils/pagination";
import { CategoryValidator, type CategoryPayload } from "../validators/CategoryValidator";
import { CategoryFormatter } from "../formatters/CategoryFormatter";

export class CategoryController {
  static async index(req: Request, res: Response) {
    const categories = await Category.findAll({
      where: { is_active: true },
      order: [["label", "ASC"]],
      attributes: ["id", "slug", "label", "icon", "is_active", "createdAt", "updatedAt"]
    });

    const sanitizedCategories = categories.map((cat) => CategoryFormatter.sanitizeCategory(cat));
    const pagination = parsePagination({
      page: req.query.page,
      limit: req.query.limit
    });

    if (pagination) {
      return res.json(paginateItems(sanitizedCategories, pagination));
    }

    return res.json(sanitizedCategories);
  }

  static async adminIndex(req: Request, res: Response) {
    const categories = await Category.findAll({
      order: [["label", "ASC"]],
      attributes: ["id", "slug", "label", "icon", "is_active", "createdAt", "updatedAt"]
    });

    const sanitizedCategories = categories.map((cat) => CategoryFormatter.sanitizeCategory(cat));
    const pagination = parsePagination({
      page: req.query.page,
      limit: req.query.limit
    });

    if (pagination) {
      return res.json(paginateItems(sanitizedCategories, pagination));
    }

    return res.json(sanitizedCategories);
  }

  static async store(req: Request<unknown, unknown, CategoryPayload>, res: Response) {
    const { slug, label, icon, is_active } = req.body;

    const normalizedLabel = CategoryValidator.normalizeCategoryLabel(label);
    if (!normalizedLabel) {
      return res.status(400).json({ message: "label e obrigatorio" });
    }

    const normalizedSlug = CategoryValidator.normalizeCategorySlug(
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
      icon: CategoryValidator.normalizeOptionalText(icon),
      is_active: typeof is_active === "boolean" ? is_active : true
    });

    return res.status(201).json(CategoryFormatter.sanitizeCategory(createdCategory));
  }

  static async update(
    req: Request<{ id: string }, unknown, CategoryPayload>,
    res: Response
  ) {
    const categoryId = CategoryValidator.parseCategoryId(req.params.id);
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
      typeof label === "undefined" ? category.label : CategoryValidator.normalizeCategoryLabel(label);
    if (!nextLabel) {
      return res.status(400).json({ message: "label invalido" });
    }

    const slugSource =
      typeof slug === "undefined" ? category.slug : typeof slug === "string" ? slug : "";
    const nextSlug = CategoryValidator.normalizeCategorySlug(slugSource);
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
      ...(typeof icon !== "undefined" ? { icon: CategoryValidator.normalizeOptionalText(icon) } : {}),
      ...(typeof is_active === "boolean" ? { is_active } : {})
    });

    return res.json(CategoryFormatter.sanitizeCategory(category));
  }

  static async destroy(req: Request<{ id: string }>, res: Response) {
    const categoryId = CategoryValidator.parseCategoryId(req.params.id);
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
