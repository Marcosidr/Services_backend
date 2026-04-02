/**
 * Formatação de dados para admin responses
 */

import { User, Professional, UserProfile, Notification, Category } from "../models";

export class AdminFormatter {
  /**
   * Formata data para locale pt-BR
   */
  static formatDate(value: Date): string {
    return value.toLocaleDateString("pt-BR");
  }

  /**
   * Obtém data de início do mês atual
   */
  static getCurrentMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  /**
   * Extrai categorias do registro do usuário
   */
  static getUserCategories(user: User): Category[] {
    return (user.get("categories") as Category[] | undefined) ?? [];
  }

  /**
   * Extrai dados de profissional do registro do usuário
   */
  static getUserProfessional(user: User): Professional | null {
    return (user.get("professional") as Professional | undefined) ?? null;
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
    const professional = this.getUserProfessional(user);
    const profile = user.get("profile") as UserProfile | undefined;
    return this.normalizePhotoUrl(professional?.photoUrl) || this.normalizePhotoUrl(profile?.photoUrl);
  }

  /**
   * Formata anúncio para resposta
   */
  static formatAnnouncement(announcement: Notification) {
    const user = announcement.get("user") as User | undefined;

    return {
      id: String(announcement.id),
      userId: announcement.userId,
      userName: user?.name ?? "",
      userEmail: user?.email ?? "",
      title: announcement.title,
      message: announcement.message,
      isRead: announcement.isRead,
      createdAt: announcement.createdAt
    };
  }

  /**
   * Constrói distribuição de categorias de usuários aprovados
   */
  static buildCategoryDistribution(approvedUsers: User[]) {
    const categoryCount = new Map<string, number>();

    for (const user of approvedUsers) {
      const categories = this.getUserCategories(user);
      for (const category of categories) {
        const currentCount = categoryCount.get(category.label) ?? 0;
        categoryCount.set(category.label, currentCount + 1);
      }
    }

    const total = Array.from(categoryCount.values()).reduce((sum, current) => sum + current, 0);
    if (total === 0) return [];

    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        value: Math.round((count / total) * 100)
      }));
  }
}
