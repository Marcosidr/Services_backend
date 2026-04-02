/**
 * Centraliza validação de dados de notificação
 */

export class NotificationValidator {
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
   * Faz parse e limita o limite de busca de notificações (1-100)
   */
  static parseLimit(value: unknown, fallback: number = 10): number {
    const parsed = this.parsePositiveInteger(value);
    if (!parsed) return fallback;
    return Math.min(parsed, 100);
  }
}

export type NotificationQuery = {
  onlyUnread?: string;
  limit?: string;
};
