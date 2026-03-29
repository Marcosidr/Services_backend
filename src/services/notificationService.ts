import { Notification } from "../models";

type CreateNotificationInput = {
  userId: number;
  type?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

export async function createNotification(input: CreateNotificationInput) {
  return Notification.create({
    userId: input.userId,
    type: input.type ?? "system",
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? null
  });
}
