import type { Request, Response } from "express";
import { Op } from "sequelize";
import {
  Category,
  Notification,
  Professional,
  ProfessionalReview,
  User,
  UserProfile
} from "../models";
import { createNotification } from "../services/notificationService";
import { createPaginatedResponse, parsePagination } from "../utils/pagination";
import { AdminValidator, type AdminUserStatus, type ProfessionalStatus, type AdminAnnouncementPayload } from "../validators/AdminValidator";
import { AdminFormatter } from "../formatters/AdminFormatter";

export class AdminController {
  static async dashboard(req: Request, res: Response) {
    const monthStart = AdminFormatter.getCurrentMonthStart();

    const users = await User.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "email", "cpf", "role", "createdAt", "updatedAt"],
      include: [
        {
          association: "categories",
          attributes: ["id", "label"],
          through: { attributes: [] }
        },
        {
          association: "professional",
          attributes: ["id", "online", "verified", "approvalStatus", "createdAt", "updatedAt", "photoUrl"]
        },
        {
          association: "profile",
          attributes: ["photoUrl"]
        }
      ]
    });

    const usersPayload = users.map((user) => ({
      id: String(user.id),
      name: user.name,
      email: user.email,
      joined: AdminFormatter.formatDate(user.createdAt),
      orders: 0,
      status: "ativo" as AdminUserStatus
    }));

    const professionalsWithStatus = users
      .map((user) => ({
        user,
        professional: AdminFormatter.getUserProfessional(user)
      }))
      .filter((item) => Boolean(item.professional));

    const approvedUsers = professionalsWithStatus
      .filter((item) => item.professional?.approvalStatus === "approved")
      .map((item) => item.user);

    const reviewRows = approvedUsers.length
      ? await ProfessionalReview.findAll({
          where: {
            professionalUserId: {
              [Op.in]: approvedUsers.map((user) => user.id)
            }
          },
          attributes: ["professionalUserId", "rating"]
        })
      : [];

    const reviewTotalsByProfessional = new Map<number, { sum: number; count: number }>();
    for (const review of reviewRows) {
      const currentTotals = reviewTotalsByProfessional.get(review.professionalUserId) ?? {
        sum: 0,
        count: 0
      };
      currentTotals.sum += review.rating;
      currentTotals.count += 1;
      reviewTotalsByProfessional.set(review.professionalUserId, currentTotals);
    }

    const pendingProfessionals = professionalsWithStatus
      .filter((item) => item.professional?.approvalStatus === "pending")
      .map((item) => {
        const professional = item.professional!;
        const categories = AdminFormatter.getUserCategories(item.user);

        return {
          id: String(professional.id),
          name: item.user.name,
          category: categories.map((category) => category.label).join(" / ") || "Sem categoria",
          date: AdminFormatter.formatDate(professional.createdAt),
          docs: Boolean(item.user.cpf)
        };
      });

    const professionalsPayload = professionalsWithStatus
      .filter((item) => item.professional?.approvalStatus === "approved")
      .map((item) => {
        const professional = item.professional!;
        const categories = AdminFormatter.getUserCategories(item.user);
        const reviewTotals = reviewTotalsByProfessional.get(item.user.id);
        const reviewCount = reviewTotals?.count ?? 0;
        const averageRating =
          reviewTotals && reviewTotals.count > 0 ? reviewTotals.sum / reviewTotals.count : 0;

        return {
          id: String(professional.id),
          name: item.user.name,
          photo: AdminFormatter.getUserPhoto(item.user),
          categoryLabel: categories.map((category) => category.label).join(" / ") || "Sem categoria",
          rating: Number(averageRating.toFixed(1)),
          completedJobs: reviewCount,
          status: (professional.online ? "online" : "offline") as ProfessionalStatus,
          verified: Boolean(professional.verified)
        };
      });

    const usersCreatedThisMonth = users.filter((user) => user.createdAt >= monthStart).length;
    const approvedThisMonth = professionalsWithStatus.filter(
      (item) =>
        item.professional?.approvalStatus === "approved" &&
        item.professional.updatedAt >= monthStart
    ).length;

    return res.json({
      stats: {
        totalUsers: users.length,
        totalProfessionals: professionalsPayload.length,
        monthlyRevenue: 0,
        completedJobs: 0,
        activeJobs: 0,
        pendingApprovals: pendingProfessionals.length,
        pendingAmount: 0,
        refundedAmount: 0,
        totalRevenue: 0
      },
      pendingProfessionals,
      users: usersPayload,
      professionals: professionalsPayload,
      payments: [],
      categoryDistribution: AdminFormatter.buildCategoryDistribution(approvedUsers),
      monthlyMetrics: [
        {
          label: "Novos usuarios",
          value: String(usersCreatedThisMonth),
          trend: "Mes atual",
          up: true
        },
        {
          label: "Profissionais aprovados",
          value: String(approvedThisMonth),
          trend: "Mes atual",
          up: true
        },
        {
          label: "Aprovacoes pendentes",
          value: String(pendingProfessionals.length),
          trend: "Agora",
          up: pendingProfessionals.length === 0
        }
      ]
    });
  }

  static async approveProfessional(req: Request, res: Response) {
    const professionalId = AdminValidator.parseProfessionalId(req.params.id);
    if (!professionalId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const professional = await Professional.findByPk(professionalId);
    if (!professional) {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    await professional.update({
      approvalStatus: "approved",
      verified: true
    });

    await User.update(
      { role: "professional" },
      {
        where: { id: professional.userId }
      }
    );

    await createNotification({
      userId: professional.userId,
      type: "professional_approved",
      title: "Cadastro profissional aprovado",
      message: "Seu perfil foi aprovado e agora esta ativo como profissional.",
      metadata: {
        professionalId: professional.id
      }
    });

    return res.status(200).json({ message: "Profissional aprovado com sucesso" });
  }

  static async rejectProfessional(req: Request, res: Response) {
    const professionalId = AdminValidator.parseProfessionalId(req.params.id);
    if (!professionalId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const professional = await Professional.findByPk(professionalId);
    if (!professional) {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    const userId = professional.userId;

    // Deletar o profissional rejeitado
    await professional.destroy();

    // Reverter usuario para "user"
    await User.update(
      { role: "user" },
      {
        where: { id: userId }
      }
    );

    await createNotification({
      userId: userId,
      type: "professional_rejected",
      title: "Cadastro profissional recusado",
      message: "Seu cadastro profissional foi recusado. Revise os dados e tente novamente.",
      metadata: {
        professionalId: professionalId
      }
    });

    return res.status(200).json({ message: "Profissional recusado com sucesso" });
  }

  static async listAnnouncements(req: Request, res: Response) {
    const pagination = parsePagination({
      page: req.query.page,
      limit: req.query.limit
    });

    if (pagination) {
      const pagedResult = await Notification.findAndCountAll({
        where: { type: "admin_notice" },
        include: [
          {
            association: "user",
            attributes: ["id", "name", "email"]
          }
        ],
        order: [["createdAt", "DESC"]],
        limit: pagination.limit,
        offset: pagination.offset
      });

      return res.json(
        createPaginatedResponse(
          pagedResult.rows.map((announcement) => AdminFormatter.formatAnnouncement(announcement)),
          pagedResult.count,
          pagination
        )
      );
    }

    const announcements = await Notification.findAll({
      where: { type: "admin_notice" },
      include: [
        {
          association: "user",
          attributes: ["id", "name", "email"]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: 100
    });

    return res.json(announcements.map((announcement) => AdminFormatter.formatAnnouncement(announcement)));
  }

  static async createAnnouncement(
    req: Request<unknown, unknown, AdminAnnouncementPayload>,
    res: Response
  ) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const parsedUserId = AdminValidator.parsePositiveInteger(req.body.userId);
    if (!parsedUserId) {
      return res.status(400).json({ message: "userId invalido" });
    }

    // Validacao: nao permitir enviar aviso para si mesmo
    if (parsedUserId === authenticatedUserId) {
      return res.status(400).json({ message: "Nao e permitido enviar aviso para voce mesmo" });
    }

    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!title || !message) {
      return res.status(400).json({ message: "title e message sao obrigatorios" });
    }

    const targetUser = await User.findByPk(parsedUserId, {
      attributes: ["id", "name", "email"]
    });
    if (!targetUser) {
      return res.status(404).json({ message: "Usuario destino nao encontrado" });
    }

    const announcement = await Notification.create({
      userId: parsedUserId,
      type: "admin_notice",
      title,
      message,
      metadata: {
        createdByAdminId: authenticatedUserId
      }
    });

    return res.status(201).json({
      id: String(announcement.id),
      userId: announcement.userId,
      userName: targetUser.name,
      userEmail: targetUser.email,
      title: announcement.title,
      message: announcement.message,
      isRead: announcement.isRead,
      createdAt: announcement.createdAt
    });
  }

  static async updateAnnouncement(
    req: Request<{ id: string }, unknown, AdminAnnouncementPayload>,
    res: Response
  ) {
    const announcementId = AdminValidator.parsePositiveInteger(req.params.id);
    if (!announcementId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const announcement = await Notification.findByPk(announcementId);
    if (!announcement || announcement.type !== "admin_notice") {
      return res.status(404).json({ message: "Aviso nao encontrado" });
    }

    const nextUserId =
      typeof req.body.userId === "undefined"
        ? announcement.userId
        : AdminValidator.parsePositiveInteger(req.body.userId);
    if (!nextUserId) {
      return res.status(400).json({ message: "userId invalido" });
    }

    const title =
      typeof req.body.title === "undefined"
        ? announcement.title
        : typeof req.body.title === "string"
        ? req.body.title.trim()
        : "";
    const message =
      typeof req.body.message === "undefined"
        ? announcement.message
        : typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

    if (!title || !message) {
      return res.status(400).json({ message: "title e message sao obrigatorios" });
    }

    const targetUser = await User.findByPk(nextUserId, {
      attributes: ["id", "name", "email"]
    });
    if (!targetUser) {
      return res.status(404).json({ message: "Usuario destino nao encontrado" });
    }

    await announcement.update({
      userId: nextUserId,
      title,
      message
    });

    return res.json({
      id: String(announcement.id),
      userId: announcement.userId,
      userName: targetUser.name,
      userEmail: targetUser.email,
      title: announcement.title,
      message: announcement.message,
      isRead: announcement.isRead,
      createdAt: announcement.createdAt
    });
  }

  static async deleteAnnouncement(req: Request<{ id: string }>, res: Response) {
    const announcementId = AdminValidator.parsePositiveInteger(req.params.id);
    if (!announcementId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const announcement = await Notification.findByPk(announcementId);
    if (!announcement || announcement.type !== "admin_notice") {
      return res.status(404).json({ message: "Aviso nao encontrado" });
    }

    await announcement.destroy();
    return res.status(204).send();
  }
}
