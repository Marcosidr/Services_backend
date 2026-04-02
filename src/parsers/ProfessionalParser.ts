/**
 * Parser utilities para valores de entrada
 * Centraliza toda a lógica de parsing de dados não tipados
 */

export class ProfessionalParser {
  /**
   * Faz parse de ID de categoria para filtro
   */
  static parseCategoryFilter(value: unknown): number | null {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      const parsed = Number(value.trim());
      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  /**
   * Faz parse de filtro de busca de texto
   */
  static parseTextFilter(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
  }

  /**
   * Faz parse de ID de usuário
   */
  static parseUserId(value: unknown): number | null {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      const parsed = Number(value.trim());
      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  /**
   * Faz parse de ID de profissional a partir de string
   */
  static parseProfessionalId(value: unknown): number | null {
    if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) return null;

    return id;
  }

  /**
   * Faz parse de IDs de categorias - suporta array, JSON string, CSV, ou valor único
   */
  static parseCategoryIds(input: unknown): number[] | null {
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

  /**
   * Faz parse de número opcional (preço, área, etc)
   */
  static parseOptionalNumber(value: unknown): number | null {
    if (typeof value === "undefined" || value === null || value === "") return null;

    const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed)) return null;

    return parsed;
  }

  /**
   * Faz parse de booleano de status online
   */
   
  static parseOnlineFlag(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "sim";
    }

    return false;
  }

  /**
   * Normaliza campo de texto opcional
   */
   
  static normalizeOptionalText(value: string | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  /**
   * Normaliza URL de foto
   */
  static normalizePhotoUrl(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  /**
   * Normaliza campo de texto (obrigatório)
   */
   
  static normalizeText(value: string | undefined): string {
    return (value || "").trim();
  }
}
