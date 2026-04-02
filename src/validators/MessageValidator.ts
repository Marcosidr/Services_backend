/**
 * Validação para mensagens
 */

export type MessageBody = {
  recipientId?: number | string;
  text?: string;
};

export type MessageQuery = {
  withUserId?: string;
  limit?: string;
};

export type ConversationQuery = {
  limit?: string;
};

export class MessageValidator {
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
   * Faz parse de limite de busca de mensagens (1-200)
   */
  static parseLimit(value: unknown, fallback: number = 30): number {
    const parsed = this.parsePositiveInteger(value);
    if (!parsed) return fallback;
    return Math.min(parsed, 200);
  }
}
