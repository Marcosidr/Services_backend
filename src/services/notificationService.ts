import { Notification } from "../models";

type CreateNotificationInput = {
  userId: number;
  type?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

export async function createNotification(input: CreateNotificationInput) {
  // Validacao defensiva: nao permitir auto-notificacao
  const senderId = (input.metadata as any)?.senderId;
  if (senderId && input.userId === senderId) {
    throw new Error("Nao e permitido enviar notificacao para voce mesmo");
  }

  return Notification.create({
    userId: input.userId,
    type: input.type ?? "system",
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? null
  });
}
