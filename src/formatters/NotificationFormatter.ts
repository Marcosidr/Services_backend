/**
 * Formata dados de notificação para resposta
 */

import { Notification } from "../models";

export type NotificationPayload = {
  id: string;
  userId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata: unknown;
  createdAt: Date;
};

export class NotificationFormatter {
  /**
   * Converte notificação para formato de payload
   */
  static toNotificationPayload(notification: Notification): NotificationPayload {
    return {
      id: String(notification.id),
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      metadata: notification.metadata,
      createdAt: notification.createdAt
    };
  }

  /**
   * Converte array de notificações
   */
  static toNotificationPayloadList(notifications: Notification[]): NotificationPayload[] {
    return notifications.map((notification) => this.toNotificationPayload(notification));
  }
}
