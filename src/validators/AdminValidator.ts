/**
 * Validação e parsing para operações de admin
 */

export type AdminUserStatus = "ativo" | "bloqueado";
export type ProfessionalStatus = "online" | "offline";
export type AdminAnnouncementPayload = {
  userId?: number | string;
  title?: string;
  message?: string;
};

export class AdminValidator {
  /**
   * Faz parse de inteiro positivo de qualquer valor
   */
  static parsePositiveInteger(value: unknown): number | null {
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
    if (Array.isArray(value)) return null;
    if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) return null;

    return id;
  }

  /**
   * Valida status de usuário
   */
  static isValidUserStatus(status: unknown): status is AdminUserStatus {
    return status === "ativo" || status === "bloqueado";
  }

  /**
   * Valida status de profissional
   */
  static isValidProfessionalStatus(status: unknown): status is ProfessionalStatus {
    return status === "online" || status === "offline";
  }
}
