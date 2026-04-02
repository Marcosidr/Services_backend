/**
 * Formata e sanitiza dados de categoria para resposta
 */

import { Category } from "../models";

export type SanitizedCategory = {
  id: string | number;
  slug: string;
  label: string;
  icon: string | null;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class CategoryFormatter {
  /**
   * Remove caracteres especiais da categoria para resposta da API
   */
  static sanitizeCategory(category: Category): SanitizedCategory {
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

  /**
   * Remove caracteres especiais de uma lista de categorias
   */
  static sanitizeCategoryList(categories: Category[]): SanitizedCategory[] {
    return categories.map((category) => this.sanitizeCategory(category));
  }
}
