import type { Request, Response } from "express";
import { Op } from "sequelize";
import { Message, User } from "../models";
import { findOrCreateConversation } from "../services/conversationService";
import { createNotification } from "../services/notificationService";

type DashboardOrderStatus = "concluido" | "em andamento" | "cancelado" | "aguardando";

type DashboardOrder = {
  id: string;
  userId: number;
  professionalId: string;
  professionalName: string;
  category: string;
  date: string;
  price: number;
  status: DashboardOrderStatus;
  rating?: number;
};

const dashboardOrders: DashboardOrder[] = [];

function getAuthenticatedUserId(req: Request) {
  return req.user?.id ?? null;
}

function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function sanitizeDashboardMessage(authenticatedUserId: number, message: Message) {
  return {
    id: String(message.id),
    conversationId: String(message.conversationId),
    sender: message.senderId === authenticatedUserId ? "user" : "professional",
    senderId: message.senderId,
    recipientId: message.receiverId,
    text: message.message,
    read: message.isRead,
    time: message.createdAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    createdAt: message.createdAt
  };
}

export class DashboardController {
  static async index(req: Request, res: Response) {
    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const user = await User.findByPk(authenticatedUserId, {
      attributes: ["id", "name", "email"]
    });
    if (!user) {
      return res.status(401).json({ message: "Usuario da sessao nao encontrado" });
    }

    const userOrders = dashboardOrders.filter((item) => item.userId === authenticatedUserId);
    const userMessages = await Message.findAll({
      where: {
        [Op.or]: [{ senderId: authenticatedUserId }, { receiverId: authenticatedUserId }]
      },
      order: [["createdAt", "ASC"]],
      limit: 100
    });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      orders: userOrders,
      messages: userMessages.map((message) => sanitizeDashboardMessage(authenticatedUserId, message)),
      paymentMethods: [],
      paymentHistory: [],
      activeChatProfessional: null
    });
  }

  static async createMessage(req: Request, res: Response) {
    const { professionalId, recipientId, text } = req.body as {
      professionalId?: string;
      recipientId?: string | number;
      text?: string;
    };

    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const parsedRecipientId = parsePositiveInteger(recipientId ?? professionalId);
    if (!parsedRecipientId || !text || !text.trim()) {
      return res.status(400).json({ message: "recipientId/professionalId e text sao obrigatorios" });
    }

    if (parsedRecipientId === authenticatedUserId) {
      return res.status(400).json({ message: "Nao e permitido enviar mensagem para voce mesmo" });
    }

    const [sender, recipient] = await Promise.all([
      User.findByPk(authenticatedUserId, { attributes: ["id", "name"] }),
      User.findByPk(parsedRecipientId, { attributes: ["id", "name"] })
    ]);

    if (!sender) {
      return res.status(401).json({ message: "Usuario da sessao nao encontrado" });
    }

    if (!recipient) {
      return res.status(404).json({ message: "Destinatario nao encontrado" });
    }

    const savedMessage = await Message.create({
      conversationId: (await findOrCreateConversation(authenticatedUserId, parsedRecipientId)).id,
      senderId: authenticatedUserId,
      receiverId: parsedRecipientId,
      message: text.trim()
    });

    await createNotification({
      userId: parsedRecipientId,
      type: "message",
      title: "Nova mensagem",
      message: `${sender.name} enviou uma mensagem`,
      metadata: {
        senderId: authenticatedUserId,
        messageId: savedMessage.id,
        conversationId: savedMessage.conversationId
      }
    });

    return res.status(201).json(sanitizeDashboardMessage(authenticatedUserId, savedMessage));
  }

  static async rateOrder(req: Request, res: Response) {
    const { orderId } = req.params;
    const { rating } = req.body as { rating?: number };

    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    if (!orderId) return res.status(400).json({ message: "orderId invalido" });
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating deve ser um numero entre 1 e 5" });
    }

    const order = dashboardOrders.find(
      (item) => item.id === orderId && item.userId === authenticatedUserId
    );
    if (!order) return res.status(404).json({ message: "Pedido nao encontrado" });

    order.rating = rating;

    return res.status(201).json({ message: "Avaliacao registrada com sucesso" });
  }

  static async cancelOrder(req: Request, res: Response) {
    const { orderId } = req.params;

    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    if (!orderId) return res.status(400).json({ message: "orderId invalido" });

    const order = dashboardOrders.find(
      (item) => item.id === orderId && item.userId === authenticatedUserId
    );
    if (!order) return res.status(404).json({ message: "Pedido nao encontrado" });

    order.status = "cancelado";

    return res.status(200).json({ message: "Pedido cancelado com sucesso" });
  }
}
