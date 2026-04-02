/**
 * Formatação de dados de mensagens
 */

import { Message, User, Professional, UserProfile } from "../models";

export type MessageResponse = {
  id: string;
  conversationId: string;
  senderId: number;
  receiverId: number;
  sender: "user" | "professional";
  text: string;
  read: boolean;
  time: string;
  createdAt: Date;
};

export class MessageFormatter {
  /**
   * Formata mensagem para resposta da API
   */
  static mapMessageForResponse(currentUserId: number, message: Message): MessageResponse {
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

  /**
   * Normaliza URL de foto
   */
  static normalizePhotoUrl(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  /**
   * Obtém foto do usuário de profissional ou perfil
   */
  static getUserPhoto(user: User): string {
    const professional = user.get("professional") as Professional | undefined;
    const profile = user.get("profile") as UserProfile | undefined;
    return this.normalizePhotoUrl(professional?.photoUrl) || this.normalizePhotoUrl(profile?.photoUrl);
  }
}
