import type { Request, Response } from "express";
import { Op } from "sequelize";
import {
  Category,
  Message,
  Professional,
  ProfessionalReview,
  User,
  UserProfile
} from "../models";
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

type RateOrderBody = {
  rating?: number;
  comment?: string;
  professionalId?: number | string;
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

function normalizePhotoUrl(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getUserPhoto(user: User) {
  const professional = user.get("professional") as Professional | undefined;
  const profile = user.get("profile") as UserProfile | undefined;

  return normalizePhotoUrl(professional?.photoUrl) || normalizePhotoUrl(profile?.photoUrl);
}

function getUserBio(user: User) {
  const profile = user.get("profile") as UserProfile | undefined;
  return profile?.bio ?? null;
}

export class DashboardController {
  static async index(req: Request, res: Response) {
    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const user = await User.findByPk(authenticatedUserId, {
      attributes: [
        "id",
        "name",
        "email",
        "phone",
        "cep",
        "endereco",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "uf",
        "estado",
        "role"
      ],
      include: [
        {
          association: "professional",
          attributes: ["photoUrl"]
        },
        {
          association: "profile",
          attributes: ["photoUrl", "bio"]
        }
      ]
    });
    if (!user) {
      return res.status(401).json({ message: "Usuario da sessao nao encontrado" });
    }

    const rawUserOrders = dashboardOrders.filter((item) => item.userId === authenticatedUserId);

    const professionalIds = Array.from(
      new Set(
        rawUserOrders
          .map((item) => parsePositiveInteger(item.professionalId))
          .filter((professionalId): professionalId is number => Boolean(professionalId))
      )
    );

    const professionals = professionalIds.length
      ? await User.findAll({
          where: {
            id: {
              [Op.in]: professionalIds
            }
          },
          attributes: ["id", "name", "role"],
          include: [
            {
              association: "professional",
              attributes: ["photoUrl", "online"]
            },
            {
              association: "profile",
              attributes: ["photoUrl"]
            },
            {
              association: "categories",
              attributes: ["label"],
              through: { attributes: [] }
            }
          ]
        })
      : [];

    const professionalMap = new Map<
      number,
      {
        id: string;
        name: string;
        photo: string;
        categoryLabel: string;
        online: boolean;
      }
    >();

    for (const professionalUser of professionals) {
      const categories = (professionalUser.get("categories") as Category[] | undefined) ?? [];
      const professional = professionalUser.get("professional") as Professional | undefined;

      professionalMap.set(professionalUser.id, {
        id: String(professionalUser.id),
        name: professionalUser.name,
        photo: getUserPhoto(professionalUser),
        categoryLabel: categories.map((category) => category.label).join(" / "),
        online: Boolean(professional?.online)
      });
    }

    const userReviews = await ProfessionalReview.findAll({
      where: {
        reviewerUserId: authenticatedUserId
      },
      attributes: ["orderId", "professionalUserId", "rating"]
    });

    const ratingByOrderId = new Map<string, number>();
    const ratingByProfessionalId = new Map<number, number>();

    for (const review of userReviews) {
      if (review.orderId) {
        ratingByOrderId.set(review.orderId, review.rating);
      }

      ratingByProfessionalId.set(review.professionalUserId, review.rating);
    }

    const userOrders = rawUserOrders.map((item) => {
      const parsedProfessionalId = parsePositiveInteger(item.professionalId);
      const professional = parsedProfessionalId ? professionalMap.get(parsedProfessionalId) : null;

      return {
        ...item,
        professionalName: professional?.name ?? item.professionalName,
        rating:
          item.rating ??
          ratingByOrderId.get(item.id) ??
          (parsedProfessionalId ? ratingByProfessionalId.get(parsedProfessionalId) : undefined),
        professional: professional ?? undefined
      };
    });

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
        email: user.email,
        phone: user.phone,
        cep: user.cep,
        endereco: user.endereco,
        numero: user.numero,
        complemento: user.complemento,
        bairro: user.bairro,
        cidade: user.cidade,
        uf: user.uf,
        estado: user.estado,
        photo: getUserPhoto(user),
        bio: getUserBio(user),
        role: user.role
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
    const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
    const { rating, comment, professionalId } = req.body as RateOrderBody;

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

    const parsedProfessionalId = parsePositiveInteger(
      professionalId ?? order?.professionalId
    );

    if (!parsedProfessionalId) {
      return res.status(400).json({
        message: "professionalId invalido"
      });
    }

    const professionalUser = await User.findByPk(parsedProfessionalId, {
      attributes: ["id", "role"]
    });

    if (!professionalUser || professionalUser.role !== "professional") {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    const normalizedComment =
      typeof comment === "string" && comment.trim() ? comment.trim() : null;
    const normalizedOrderId = orderId.trim() || null;

    const existingReview = await ProfessionalReview.findOne({
      where: {
        reviewerUserId: authenticatedUserId,
        ...(orderId
          ? {
              orderId: normalizedOrderId,
              professionalUserId: parsedProfessionalId
            }
          : { professionalUserId: parsedProfessionalId })
      }
    });

    if (existingReview) {
      await existingReview.update({
        professionalUserId: parsedProfessionalId,
        rating,
        comment: normalizedComment,
        orderId: normalizedOrderId
      });
    } else {
      await ProfessionalReview.create({
        reviewerUserId: authenticatedUserId,
        professionalUserId: parsedProfessionalId,
        rating,
        comment: normalizedComment,
        orderId: normalizedOrderId
      });
    }

    if (order) {
      order.rating = rating;
    }

    return res.status(201).json({
      message: "Avaliacao registrada com sucesso"
    });
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
