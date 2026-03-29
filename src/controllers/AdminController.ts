import type { Request, Response } from "express";
import { Category, Professional, User } from "../models";
import { createNotification } from "../services/notificationService";

type AdminUserStatus = "ativo" | "bloqueado";
type ProfessionalStatus = "online" | "offline";

function parseProfessionalId(value: unknown) {
  if (Array.isArray(value)) return null;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return id;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("pt-BR");
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function getUserCategories(user: User) {
  return (user.get("categories") as Category[] | undefined) ?? [];
}

function getUserProfessional(user: User) {
  return (user.get("professional") as Professional | undefined) ?? null;
}

function buildCategoryDistribution(approvedUsers: User[]) {
  const categoryCount = new Map<string, number>();

  for (const user of approvedUsers) {
    const categories = getUserCategories(user);
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

export class AdminController {
  static async dashboard(req: Request, res: Response) {
    const monthStart = getCurrentMonthStart();

    const users = await User.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "email", "role", "createdAt", "updatedAt"],
      include: [
        {
          association: "categories",
          attributes: ["id", "label"],
          through: { attributes: [] }
        },
        {
          association: "professional",
          attributes: ["id", "online", "verified", "approvalStatus", "createdAt", "updatedAt"]
        }
      ]
    });

    const usersPayload = users.map((user) => ({
      id: String(user.id),
      name: user.name,
      email: user.email,
      joined: formatDate(user.createdAt),
      orders: 0,
      status: "ativo" as AdminUserStatus
    }));

    const professionalsWithStatus = users
      .map((user) => ({
        user,
        professional: getUserProfessional(user)
      }))
      .filter((item) => Boolean(item.professional));

    const approvedUsers = professionalsWithStatus
      .filter((item) => item.professional?.approvalStatus === "approved")
      .map((item) => item.user);

    const pendingProfessionals = professionalsWithStatus
      .filter((item) => item.professional?.approvalStatus === "pending")
      .map((item) => {
        const professional = item.professional!;
        const categories = getUserCategories(item.user);

        return {
          id: String(professional.id),
          name: item.user.name,
          category: categories.map((category) => category.label).join(" / ") || "Sem categoria",
          date: formatDate(professional.createdAt),
          docs: Boolean(item.user.cpf)
        };
      });

    const professionalsPayload = professionalsWithStatus
      .filter((item) => item.professional?.approvalStatus === "approved")
      .map((item) => {
        const professional = item.professional!;
        const categories = getUserCategories(item.user);

        return {
          id: String(professional.id),
          name: item.user.name,
          photo: "",
          categoryLabel: categories.map((category) => category.label).join(" / ") || "Sem categoria",
          rating: 0,
          completedJobs: 0,
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
      categoryDistribution: buildCategoryDistribution(approvedUsers),
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
    const professionalId = parseProfessionalId(req.params.id);
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
    const professionalId = parseProfessionalId(req.params.id);
    if (!professionalId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const professional = await Professional.findByPk(professionalId);
    if (!professional) {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    await professional.update({
      approvalStatus: "rejected",
      verified: false,
      online: false
    });

    await User.update(
      { role: "user" },
      {
        where: { id: professional.userId }
      }
    );

    await createNotification({
      userId: professional.userId,
      type: "professional_rejected",
      title: "Cadastro profissional recusado",
      message: "Seu cadastro profissional foi recusado. Revise os dados e tente novamente.",
      metadata: {
        professionalId: professional.id
      }
    });

    return res.status(200).json({ message: "Profissional recusado com sucesso" });
  }
}
