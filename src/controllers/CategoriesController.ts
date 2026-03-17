import { Request, Response } from "express";
import { Category } from "../models/Category";

type CategorySlug =
  | "PINTOR"
  | "PEDREIRO"
  | "ELETRICISTA"
  | "ENCANADOR"
  | "GESSEIRO"
  | "MARCENEIRO"
  | "SERRALHEIRO"
  | "VIDRACEIRO"
  | "CHAVEIRO"
  | "JARDINEIRO"
  | "MONTADOR_MOVEIS"
  | "TECNICO_AR_CONDICIONADO"
  | "TECNICO_INFORMATICA"
  | "DIARISTA"
  | "REPAROS_GERAIS";


  type CategoryPayload = {
  slug?: string;
  label?: string;
  icon?: string;
  is_active?:String;
};


function sanitizeCategory(Category: Category) {
  return {
    id: Category.id,
    slug: Category.slug,
    label: Category.label,
    is_active: Category.is_active,
    createdAt: Category.createdAt,
    updatedAt: Category.updatedAt
  };
}
export class CategoryController {
  static async index(req: Request, res: Response) {
   const categories = await Category.findAll({
  order: [["createdAt", "DESC"]],
  attributes: ["id", "slug", "label", "icon", "is_active", "createdAt", "updatedAt"]
});
return res.json(categories.map(sanitizeCategory));
  }
}
