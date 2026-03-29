import type { Request, Response } from "express";
import { Op } from "sequelize";
import { Message, User } from "../models";
import { findOrCreateConversation } from "../services/conversationService";
import { createNotification } from "../services/notificationService";

type MessageBody = {
  recipientId?: number | string;
  text?: string;
};

type MessageQuery = {
  withUserId?: string;
  limit?: string;
};

type ConversationQuery = {
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
  return Math.min(parsed, 200);
}

function mapMessageForResponse(currentUserId: number, message: Message) {
  return {
    id: String(message.id),
    conversationId: String(message.conversationId),
    senderId: message.senderId,
    receiverId: message.receiverId,
    sender: message.senderId === currentUserId ? "user" : "professional",
    text: message.message,
    read: message.isRead,
    time: message.createdAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    createdAt: message.createdAt
  };
}

export class MessagesController {
  static async conversations(
    req: Request<unknown, unknown, unknown, ConversationQuery>,
    res: Response
  ) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const limit = parseLimit(req.query.limit, 30);
    const scanLimit = Math.max(limit * 40, 400);

    const messages = await Message.findAll({
      where: {
        [Op.or]: [{ senderId: authenticatedUserId }, { receiverId: authenticatedUserId }]
      },
      include: [
        {
          association: "sender",
          attributes: ["id", "name"]
        },
        {
          association: "recipient",
          attributes: ["id", "name"]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: scanLimit
    });

    const conversationsMap = new Map<
      number,
      {
        conversationId: string;
        otherUserId: number;
        otherUserName: string;
        lastMessage: {
          id: string;
          senderId: number;
          text: string;
          read: boolean;
          time: string;
          createdAt: Date;
        };
        unreadCount: number;
      }
    >();

    for (const message of messages) {
      const sender = message.get("sender") as User | undefined;
      const recipient = message.get("recipient") as User | undefined;
      const otherUser = message.senderId === authenticatedUserId ? recipient : sender;
      if (!otherUser) continue;

      const key = message.conversationId;
      const existingConversation = conversationsMap.get(key);

      if (!existingConversation) {
        conversationsMap.set(key, {
          conversationId: String(message.conversationId),
          otherUserId: otherUser.id,
          otherUserName: otherUser.name,
          lastMessage: {
            id: String(message.id),
            senderId: message.senderId,
            text: message.message,
            read: message.isRead,
            time: message.createdAt.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit"
            }),
            createdAt: message.createdAt
          },
          unreadCount: message.receiverId === authenticatedUserId && !message.isRead ? 1 : 0
        });
        continue;
      }

      if (message.receiverId === authenticatedUserId && !message.isRead) {
        existingConversation.unreadCount += 1;
      }
    }

    return res.json({
      items: Array.from(conversationsMap.values()).slice(0, limit)
    });
  }

  static async index(req: Request<unknown, unknown, unknown, MessageQuery>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const withUserId = parsePositiveInteger(req.query.withUserId);
    const limit = parseLimit(req.query.limit, 80);

    const where = withUserId
      ? {
          [Op.or]: [
            {
              senderId: authenticatedUserId,
              receiverId: withUserId
            },
            {
              senderId: withUserId,
              receiverId: authenticatedUserId
            }
          ]
        }
      : {
          [Op.or]: [{ senderId: authenticatedUserId }, { receiverId: authenticatedUserId }]
        };

    const messages = await Message.findAll({
      where,
      order: [["createdAt", "ASC"]],
      limit
    });

    const unreadCount = await Message.count({
      where: {
        receiverId: authenticatedUserId,
        isRead: false
      }
    });

    return res.json({
      items: messages.map((message) => mapMessageForResponse(authenticatedUserId, message)),
      unreadCount
    });
  }

  static async store(req: Request<unknown, unknown, MessageBody>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const { recipientId, text } = req.body;
    const parsedRecipientId = parsePositiveInteger(recipientId);
    if (!parsedRecipientId) {
      return res.status(400).json({ message: "recipientId invalido" });
    }

    if (parsedRecipientId === authenticatedUserId) {
      return res.status(400).json({ message: "Nao e permitido enviar mensagem para voce mesmo" });
    }

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text e obrigatorio" });
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

    const conversation = await findOrCreateConversation(authenticatedUserId, parsedRecipientId);

    const savedMessage = await Message.create({
      conversationId: conversation.id,
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
        conversationId: conversation.id
      }
    });

    return res.status(201).json(mapMessageForResponse(authenticatedUserId, savedMessage));
  }

  static async update(req: Request<{ id: string }, unknown, { text?: string }>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const messageId = parsePositiveInteger(req.params.id);
    if (!messageId) return res.status(400).json({ message: "id invalido" });

    const { text } = req.body;
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text e obrigatorio" });
    }

    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ message: "Mensagem nao encontrada" });
    }

    if (message.senderId !== authenticatedUserId) {
      return res.status(403).json({ message: "Voce nao pode editar esta mensagem" });
    }

    await message.update({
      message: text.trim()
    });

    return res.json(mapMessageForResponse(authenticatedUserId, message));
  }

  static async markAsRead(req: Request<{ id: string }>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const messageId = parsePositiveInteger(req.params.id);
    if (!messageId) return res.status(400).json({ message: "id invalido" });

    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ message: "Mensagem nao encontrada" });
    }

    if (message.receiverId !== authenticatedUserId) {
      return res.status(403).json({ message: "Voce nao pode alterar esta mensagem" });
    }

    if (!message.isRead) {
      await message.update({ isRead: true });
    }

    return res.json(mapMessageForResponse(authenticatedUserId, message));
  }

  static async destroy(req: Request<{ id: string }>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const messageId = parsePositiveInteger(req.params.id);
    if (!messageId) return res.status(400).json({ message: "id invalido" });

    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ message: "Mensagem nao encontrada" });
    }

    if (message.senderId !== authenticatedUserId && message.receiverId !== authenticatedUserId) {
      return res.status(403).json({ message: "Voce nao pode remover esta mensagem" });
    }

    await message.destroy();
    return res.status(204).send();
  }
}
