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
import {
  canUsersChat,
  createServiceOrder,
  getOrderForProfessional,
  getOrderForRequester,
  hasPendingOrInProgressOrder,
  listOrdersForProfessional,
  listOrdersForRequester,
  setOrderRating,
  updateOrderStatus
} from "../services/orderService";

type DashboardOrderStatus = "concluido" | "em andamento" | "cancelado" | "aguardando";

type DashboardOrder = {
  id: string;
  userId: number;
  requesterId: string;
  requesterName: string;
  requesterPhoto?: string;
  professionalId: string;
  professionalName: string;
  professionalPhoto?: string;
  category: string;
  description?: string | null;
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

type CreateOrderBody = {
  professionalId?: number | string;
  description?: string;
  scheduleDate?: string;
  scheduleTime?: string;
};

function getAuthenticatedUserId(req: { user?: { id?: number } }) {
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

    const rawUserOrders =
      user.role === "professional"
        ? await listOrdersForProfessional(authenticatedUserId)
        : await listOrdersForRequester(authenticatedUserId);

    const relatedUserIds = Array.from(
      new Set(
        rawUserOrders.flatMap((order) => [order.requesterUserId, order.professionalUserId])
      )
    );

    const relatedUsers = relatedUserIds.length
      ? await User.findAll({
          where: {
            id: {
              [Op.in]: relatedUserIds
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

    const relatedUserMap = new Map<
      number,
      {
        id: string;
        name: string;
        photo: string;
        categoryLabel: string;
        online: boolean;
      }
    >();

    for (const relatedUser of relatedUsers) {
      const categories = (relatedUser.get("categories") as Category[] | undefined) ?? [];
      const professional = relatedUser.get("professional") as Professional | undefined;

      relatedUserMap.set(relatedUser.id, {
        id: String(relatedUser.id),
        name: relatedUser.name,
        photo: getUserPhoto(relatedUser),
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

    for (const review of userReviews) {
      if (review.orderId) {
        ratingByOrderId.set(review.orderId, review.rating);
      }
    }

    const userOrders: DashboardOrder[] = rawUserOrders.map((item) => {
      const professional = relatedUserMap.get(item.professionalUserId);
      const requester = relatedUserMap.get(item.requesterUserId);

      return {
        id: item.id,
        userId: item.requesterUserId,
        requesterId: String(item.requesterUserId),
        requesterName: requester?.name ?? item.requesterName,
        requesterPhoto: requester?.photo ?? "",
        professionalId: String(item.professionalUserId),
        professionalName: professional?.name ?? item.professionalName,
        professionalPhoto: professional?.photo ?? "",
        category: item.category,
        description: item.description,
        date: item.date,
        price: item.price,
        status: item.status,
        rating: item.rating ?? ratingByOrderId.get(item.id),
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

  static async createOrder(req: Request<unknown, unknown, CreateOrderBody>, res: Response) {
    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const { professionalId, description, scheduleDate, scheduleTime } = req.body;
    const parsedProfessionalId = parsePositiveInteger(professionalId);

    if (!parsedProfessionalId) {
      return res.status(400).json({ message: "professionalId invalido" });
    }

    if (parsedProfessionalId === authenticatedUserId) {
      return res.status(400).json({ message: "Nao e permitido criar pedido para voce mesmo" });
    }

    const [requesterUser, professionalUser] = await Promise.all([
      User.findByPk(authenticatedUserId, {
        attributes: ["id", "name", "role"]
      }),
      User.findByPk(parsedProfessionalId, {
        attributes: ["id", "name", "role"],
        include: [
          {
            association: "professional",
            attributes: ["price"]
          },
          {
            association: "categories",
            attributes: ["label"],
            through: { attributes: [] }
          }
        ]
      })
    ]);

    if (!requesterUser) {
      return res.status(401).json({ message: "Usuario da sessao nao encontrado" });
    }

    if (!professionalUser || professionalUser.role !== "professional") {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    if (await hasPendingOrInProgressOrder(authenticatedUserId, parsedProfessionalId)) {
      return res.status(409).json({
        message: "Voce ja possui um pedido aberto com este profissional"
      });
    }

    const categories = (professionalUser.get("categories") as Category[] | undefined) ?? [];
    const professional = professionalUser.get("professional") as Professional | undefined;

    const categoryLabel =
      categories.length > 0
        ? categories.map((category) => category.label).join(" / ")
        : "Servico geral";

    let requestDate = new Date().toISOString();
    if (typeof scheduleDate === "string" && scheduleDate.trim()) {
      const normalizedDate = scheduleDate.trim();
      const normalizedTime =
        typeof scheduleTime === "string" && scheduleTime.trim()
          ? scheduleTime.trim()
          : "09:00";
      const parsedDate = new Date(`${normalizedDate}T${normalizedTime}:00`);
      if (!Number.isNaN(parsedDate.getTime())) {
        requestDate = parsedDate.toISOString();
      }
    }

    const createdOrder = await createServiceOrder({
      requesterUserId: authenticatedUserId,
      professionalUserId: parsedProfessionalId,
      requesterName: requesterUser.name,
      professionalName: professionalUser.name,
      category: categoryLabel,
      description,
      date: requestDate,
      price: Number(professional?.price ?? 0)
    });

    await createNotification({
      userId: parsedProfessionalId,
      type: "order_request",
      title: "Novo pedido de atendimento",
      message: `${requesterUser.name} enviou um pedido de atendimento`,
      metadata: {
        orderId: createdOrder.id,
        senderId: requesterUser.id,
        requesterId: requesterUser.id,
        target: "orders"
      }
    });

    return res.status(201).json({
      message: "Pedido criado com sucesso",
      order: createdOrder
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
      User.findByPk(authenticatedUserId, { attributes: ["id", "name", "role"] }),
      User.findByPk(parsedRecipientId, { attributes: ["id", "name", "role"] })
    ]);

    if (!sender) {
      return res.status(401).json({ message: "Usuario da sessao nao encontrado" });
    }

    if (!recipient) {
      return res.status(404).json({ message: "Destinatario nao encontrado" });
    }

    const senderIsProfessional = sender.role === "professional";
    const recipientIsProfessional = recipient.role === "professional";
    const requiresAcceptedOrder =
      (senderIsProfessional && recipient.role === "user") ||
      (recipientIsProfessional && sender.role === "user");

    if (requiresAcceptedOrder && !(await canUsersChat(authenticatedUserId, parsedRecipientId))) {
      return res.status(403).json({
        message: "Chat liberado somente apos o profissional aceitar o pedido"
      });
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

    const order = await getOrderForRequester(orderId, authenticatedUserId);
    if (!order) {
      return res.status(404).json({ message: "Pedido nao encontrado" });
    }

    if (order.status !== "concluido") {
      return res.status(400).json({
        message: "A avaliacao so pode ser enviada apos a conclusao do atendimento"
      });
    }

    const parsedProfessionalId = parsePositiveInteger(
      professionalId ?? order.professionalUserId
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

    await setOrderRating(order, rating);

    return res.status(201).json({
      message: "Avaliacao registrada com sucesso"
    });
  }

  static async acceptOrder(req: Request<{ orderId: string }>, res: Response) {
    const { orderId } = req.params;
    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    if (!orderId) return res.status(400).json({ message: "orderId invalido" });

    const order = await getOrderForProfessional(orderId, authenticatedUserId);
    if (!order) return res.status(404).json({ message: "Pedido nao encontrado" });

    if (order.status !== "aguardando") {
      return res.status(400).json({ message: "Este pedido nao pode mais ser aceito" });
    }

    await updateOrderStatus(order, "em andamento");

    await createNotification({
      userId: order.requesterUserId,
      type: "order_accepted",
      title: "Pedido aceito",
      message: `${order.professionalName} aceitou seu pedido e liberou o chat`,
      metadata: {
        orderId: order.id,
        senderId: order.professionalUserId,
        target: "orders"
      }
    });

    return res.status(200).json({ message: "Pedido aceito com sucesso" });
  }

  static async rejectOrder(req: Request<{ orderId: string }>, res: Response) {
    const { orderId } = req.params;
    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    if (!orderId) return res.status(400).json({ message: "orderId invalido" });

    const order = await getOrderForProfessional(orderId, authenticatedUserId);
    if (!order) return res.status(404).json({ message: "Pedido nao encontrado" });

    if (order.status !== "aguardando") {
      return res.status(400).json({ message: "Este pedido nao pode mais ser recusado" });
    }

    await updateOrderStatus(order, "cancelado");

    await createNotification({
      userId: order.requesterUserId,
      type: "order_rejected",
      title: "Pedido recusado",
      message: `${order.professionalName} recusou o pedido de atendimento`,
      metadata: {
        orderId: order.id,
        senderId: order.professionalUserId,
        target: "orders"
      }
    });

    return res.status(200).json({ message: "Pedido recusado com sucesso" });
  }

  static async completeOrder(req: Request<{ orderId: string }>, res: Response) {
    const { orderId } = req.params;
    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    if (!orderId) return res.status(400).json({ message: "orderId invalido" });

    const order = await getOrderForProfessional(orderId, authenticatedUserId);
    if (!order) return res.status(404).json({ message: "Pedido nao encontrado" });

    if (order.status !== "em andamento") {
      return res.status(400).json({ message: "Somente atendimento em andamento pode ser finalizado" });
    }

    await updateOrderStatus(order, "concluido");

    await createNotification({
      userId: order.requesterUserId,
      type: "order_completed",
      title: "Atendimento concluido",
      message: `${order.professionalName} finalizou o atendimento. Agora voce pode avaliar`,
      metadata: {
        orderId: order.id,
        senderId: order.professionalUserId,
        target: "orders"
      }
    });

    return res.status(200).json({ message: "Atendimento finalizado com sucesso" });
  }

  static async cancelOrder(req: Request<{ orderId: string }>, res: Response) {
    const { orderId } = req.params;

    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    if (!orderId) return res.status(400).json({ message: "orderId invalido" });

    const order = await getOrderForRequester(orderId, authenticatedUserId);
    if (!order) return res.status(404).json({ message: "Pedido nao encontrado" });

    if (order.status === "concluido") {
      return res.status(400).json({ message: "Nao e possivel cancelar pedido concluido" });
    }

    await updateOrderStatus(order, "cancelado");

    await createNotification({
      userId: order.professionalUserId,
      type: "order_canceled",
      title: "Pedido cancelado",
      message: `${order.requesterName} cancelou o pedido de atendimento`,
      metadata: {
        orderId: order.id,
        senderId: order.requesterUserId,
        target: "orders"
      }
    });

    return res.status(200).json({ message: "Pedido cancelado com sucesso" });
  }
}
