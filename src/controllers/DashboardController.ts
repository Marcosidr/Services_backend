import type { Request, Response } from "express";
import { User } from "../models";

type DashboardOrderStatus = "concluido" | "em andamento" | "cancelado" | "aguardando";

type DashboardMessage = {
  id: string;
  userId: number;
  sender: "user" | "professional";
  text: string;
  time: string;
};

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

const dashboardMessages: DashboardMessage[] = [];
const dashboardOrders: DashboardOrder[] = [];

function nowAsPtBrTime() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getAuthenticatedUserId(req: Request) {
  return req.user?.id ?? null;
}

function sanitizeDashboardMessage(message: DashboardMessage) {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text,
    time: message.time
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
    const userMessages = dashboardMessages
      .filter((item) => item.userId === authenticatedUserId)
      .map(sanitizeDashboardMessage);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      orders: userOrders,
      messages: userMessages,
      paymentMethods: [],
      paymentHistory: [],
      activeChatProfessional: null
    });
  }

  static async createMessage(req: Request, res: Response) {
    const { professionalId, text } = req.body as {
      professionalId?: string;
      text?: string;
    };

    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    if (!professionalId || !text || !text.trim()) {
      return res.status(400).json({ message: "professionalId e text sao obrigatorios" });
    }

    const savedMessage: DashboardMessage = {
      id: `msg-${Date.now()}`,
      userId: authenticatedUserId,
      sender: "user",
      text: text.trim(),
      time: nowAsPtBrTime()
    };

    dashboardMessages.push(savedMessage);

    return res.status(201).json(sanitizeDashboardMessage(savedMessage));
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
