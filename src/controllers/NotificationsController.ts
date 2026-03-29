import type { Request, Response } from "express";
import { Notification } from "../models";

type NotificationQuery = {
  onlyUnread?: string;
  limit?: string;
};

function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parseLimit(value: unknown, fallback: number) {
  const parsed = parsePositiveInteger(value);
  if (!parsed) return fallback;
  return Math.min(parsed, 100);
}

function toNotificationPayload(notification: Notification) {
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

export class NotificationsController {
  static async index(req: Request<unknown, unknown, unknown, NotificationQuery>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const onlyUnread = req.query.onlyUnread === "true";
    const limit = parseLimit(req.query.limit, 10);

    const [notifications, unreadCount] = await Promise.all([
      Notification.findAll({
        where: {
          userId: authenticatedUserId,
          ...(onlyUnread ? { isRead: false } : {})
        },
        order: [["createdAt", "DESC"]],
        limit
      }),
      Notification.count({
        where: {
          userId: authenticatedUserId,
          isRead: false
        }
      })
    ]);

    return res.json({
      items: notifications.map(toNotificationPayload),
      unreadCount
    });
  }

  static async unreadCount(req: Request, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const unreadCount = await Notification.count({
      where: {
        userId: authenticatedUserId,
        isRead: false
      }
    });

    return res.json({ unreadCount });
  }

  static async markAsRead(req: Request<{ id: string }>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const notificationId = parsePositiveInteger(req.params.id);
    if (!notificationId) return res.status(400).json({ message: "id invalido" });

    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notificacao nao encontrada" });
    }

    if (notification.userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Voce nao pode alterar esta notificacao" });
    }

    if (!notification.isRead) {
      await notification.update({ isRead: true });
    }

    return res.json(toNotificationPayload(notification));
  }

  static async markAllAsRead(req: Request, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    await Notification.update(
      { isRead: true },
      {
        where: {
          userId: authenticatedUserId,
          isRead: false
        }
      }
    );

    return res.status(200).json({ message: "Notificacoes marcadas como lidas" });
  }

  static async clearAll(req: Request, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const deletedCount = await Notification.destroy({
      where: {
        userId: authenticatedUserId
      }
    });

    return res.status(200).json({
      message: "Notificacoes removidas com sucesso",
      deletedCount
    });
  }

  static async destroy(req: Request<{ id: string }>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const notificationId = parsePositiveInteger(req.params.id);
    if (!notificationId) return res.status(400).json({ message: "id invalido" });

    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notificacao nao encontrada" });
    }

    if (notification.userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Voce nao pode remover esta notificacao" });
    }

    await notification.destroy();
    return res.status(204).send();
  }
}
