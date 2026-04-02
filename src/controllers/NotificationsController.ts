import type { Request, Response } from "express";
import { Notification } from "../models";
import { NotificationValidator, type NotificationQuery } from "../validators/NotificationValidator";
import { NotificationFormatter } from "../formatters/NotificationFormatter";

export class NotificationsController {
  static async index(req: Request<unknown, unknown, unknown, NotificationQuery>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const onlyUnread = req.query.onlyUnread === "true";
    const limit = NotificationValidator.parseLimit(req.query.limit, 10);

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
      items: NotificationFormatter.toNotificationPayloadList(notifications),
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

    const notificationId = NotificationValidator.parsePositiveInteger(req.params.id);
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

    return res.json(NotificationFormatter.toNotificationPayload(notification));
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

    const notificationId = NotificationValidator.parsePositiveInteger(req.params.id);
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
