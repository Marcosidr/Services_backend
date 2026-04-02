/**
 * Centraliza validação e parsing de dados de categoria
 */

export class CategoryValidator {
  /**
   * Faz parse de ID de categoria a partir de string
   */
  static parseCategoryId(value: string): number | null {
    if (!/^\d+$/.test(value)) return null;
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return id;
  }

  /**
   * Normaliza texto opcional (slug, rótulo, ícone)
   */
  static normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  /**
   * Normaliza e valida rótulo de categoria
   */
  static normalizeCategoryLabel(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  /**
   * Normaliza slug: remove acentos, caracteres especiais, minuúsculas -> maiúsculas
   * Entrada: "Manutenção de A/C" -> "MANUTENCAO_DE_AC"
   */
  static normalizeCategorySlug(value: string): string | null {
    const normalized = value
      .normalize("NFD") // Decompose accents
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[^a-zA-Z0-9]+/g, "_") // Replace non-alphanumeric with _
      .replace(/^_+|_+$/g, "") // Remove leading/trailing _
      .replace(/_+/g, "_") // Collapse multiple _
      .toUpperCase();

    return normalized || null;
  }

  /**
   * Valida formato de slug (já normalizado por normalizeCategorySlug)
   */
  static isValidCategorySlug(slug: string): boolean {
    return /^[A-Z0-9_]+$/.test(slug) && slug.length > 0;
  }

  /**
   * Valida formato de rótulo
   */
  static isValidCategoryLabel(label: string): boolean {
    return label.length > 0 && label.length <= 255;
  }
}

export type CategoryPayload = {
  slug?: string;
  label?: string;
  icon?: string | null;
  is_active?: boolean;
};
