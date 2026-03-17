import type { Request, Response } from "express";
import { User } from "../models";

type DashboardOrderStatus = "concluido" | "em andamento" | "cancelado" | "aguardando";

type DashboardMessage = {
  id: string;
  sender: "user" | "professional";
  text: string;
  time: string;
};

type DashboardOrder = {
  id: string;
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

export class DashboardController {
  static async index(req: Request, res: Response) {
    const user = await User.findOne({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "email"]
    });

    return res.json({
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email
          }
        : null,
      orders: dashboardOrders,
      messages: dashboardMessages,
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

    if (!professionalId || !text || !text.trim()) {
      return res.status(400).json({ message: "professionalId e text sao obrigatorios" });
    }

    const savedMessage: DashboardMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: text.trim(),
      time: nowAsPtBrTime()
    };

    dashboardMessages.push(savedMessage);

    return res.status(201).json(savedMessage);
  }

  static async rateOrder(req: Request, res: Response) {
    const { orderId } = req.params;
    const { rating } = req.body as { rating?: number };

    if (!orderId) return res.status(400).json({ message: "orderId invalido" });
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating deve ser um numero entre 1 e 5" });
    }

    const order = dashboardOrders.find((item) => item.id === orderId);
    if (order) {
      order.rating = rating;
    }

    return res.status(201).json({ message: "Avaliacao registrada com sucesso" });
  }

  static async cancelOrder(req: Request, res: Response) {
    const { orderId } = req.params;

    if (!orderId) return res.status(400).json({ message: "orderId invalido" });

    const order = dashboardOrders.find((item) => item.id === orderId);
    if (order) {
      order.status = "cancelado";
    }

    return res.status(200).json({ message: "Pedido cancelado com sucesso" });
  }
}
