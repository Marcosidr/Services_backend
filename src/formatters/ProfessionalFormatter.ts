import { Op } from "sequelize";
import { Category, Professional, ProfessionalReview, User, UserProfile } from "../models";
import { calculateDistanceKm, type GeoPoint } from "../utils/geo";
import { ProfessionalParser } from "../parsers/ProfessionalParser";

export type SanitizedReview = {
  id: string;
  user: string;
  userPhoto: string;
  rating: number;
  date: string;
  text: string;
};

export type ReviewSnapshot = {
  rating: number;
  reviews: number;
  reviewList: SanitizedReview[];
};

export type SanitizedProfessional = {
  id: string;
  name: string;
  photo: string;
  online: boolean;
  verified: boolean;
  categoryLabel: string;
  categoryIds: string[];
  rating: number;
  reviews: number;
  city: string;
  distance: number | null;
  completedJobs: number;
  area: number;
  description: string;
  tags: string[];
  price: number;
  priceUnit: string;
  phone: string;
  reviewList: SanitizedReview[];
};

/**
 * Formatação e sanitização de dados de profissional
 */
export class ProfessionalFormatter {
  /**
   * Formata estrutura de categorias para include
   */
  static getCategoriesInclude() {
    return [
      {
        association: "categories",
        attributes: ["id", "slug", "label", "icon", "is_active"],
        through: { attributes: [] }
      },
      {
        association: "professional",
        attributes: [
          "id",
          "cpf",
          "description",
          "experience",
          "price",
          "priceUnit",
          "areaKm",
          "cep",
          "city",
          "latitude",
          "longitude",
          "online",
          "verified",
          "approvalStatus",
          "photoUrl"
        ]
      },
      {
        association: "profile",
        attributes: ["photoUrl"]
      }
    ];
  }

  /**
   * Sanitiza profissional para resposta API
   */
  static sanitizeProfessional(
    user: User,
    reviewSnapshot?: ReviewSnapshot,
    requesterLocation?: GeoPoint | null
  ): SanitizedProfessional {
    const categories = (user.get("categories") as Category[] | undefined) ?? [];
    const professional = user.get("professional") as Professional | undefined;
    const profile = user.get("profile") as UserProfile | undefined;

    const categoryLabels = categories.map((category) => category.label);
    const categoryIds = categories.map((category) => String(category.id));
    const photo =
      ProfessionalParser.normalizePhotoUrl(professional?.photoUrl) ||
      ProfessionalParser.normalizePhotoUrl(profile?.photoUrl);
    const rating = reviewSnapshot?.rating ?? 0;
    const reviews = reviewSnapshot?.reviews ?? 0;
    const professionalLatitude =
      typeof professional?.latitude === "number" ? professional.latitude : null;
    const professionalLongitude =
      typeof professional?.longitude === "number" ? professional.longitude : null;
    const distance =
      requesterLocation &&
      professionalLatitude !== null &&
      professionalLongitude !== null
        ? calculateDistanceKm(requesterLocation, {
            latitude: professionalLatitude,
            longitude: professionalLongitude
          })
        : null;

    return {
      id: String(user.id),
      name: user.name,
      photo,
      online: Boolean(professional?.online),
      verified: Boolean(professional?.verified),
      categoryLabel: categoryLabels.join(" / "),
      categoryIds,
      rating,
      reviews,
      city: professional?.city ?? "",
      distance,
      completedJobs: reviews,
      area: professional?.areaKm ?? 10,
      description: professional?.description ?? "",
      tags: categoryLabels,
      price: Number(professional?.price ?? 0),
      priceUnit: professional?.priceUnit ?? "servico",
      phone: user.phone ?? "",
      reviewList: reviewSnapshot?.reviewList ?? []
    };
  }

  /**
   * Formata data de review para pt-BR
   */
  static formatReviewDate(value: Date): string {
    return value.toLocaleDateString("pt-BR");
  }

  /**
   * Constrói snapshots de avaliações para múltiplos profissionais
   */
  static async buildReviewSnapshots(
    professionalUserIds: number[]
  ): Promise<Map<number, ReviewSnapshot>> {
    const snapshotMap = new Map<number, ReviewSnapshot>();
    if (professionalUserIds.length === 0) return snapshotMap;

    const reviews = await ProfessionalReview.findAll({
      where: {
        professionalUserId: {
          [Op.in]: professionalUserIds
        }
      },
      include: [
        {
          association: "reviewer",
          attributes: ["id", "name"],
          include: [
            {
              association: "profile",
              attributes: ["photoUrl"]
            }
          ]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const totals = new Map<number, { sum: number; count: number }>();

    for (const review of reviews) {
      const currentTotals = totals.get(review.professionalUserId) ?? {
        sum: 0,
        count: 0
      };

      currentTotals.sum += review.rating;
      currentTotals.count += 1;
      totals.set(review.professionalUserId, currentTotals);

      const currentSnapshot = snapshotMap.get(review.professionalUserId) ?? {
        rating: 0,
        reviews: 0,
        reviewList: []
      };

      if (currentSnapshot.reviewList.length < 15) {
        const reviewer = review.get("reviewer") as User | undefined;
        const reviewerProfile = reviewer?.get("profile") as UserProfile | undefined;

        currentSnapshot.reviewList.push({
          id: String(review.id),
          user: reviewer?.name ?? "Usuario",
          userPhoto: ProfessionalParser.normalizePhotoUrl(reviewerProfile?.photoUrl),
          rating: review.rating,
          date: this.formatReviewDate(review.createdAt),
          text: review.comment ?? ""
        });
      }

      snapshotMap.set(review.professionalUserId, currentSnapshot);
    }

    totals.forEach((item, professionalUserId) => {
      const currentSnapshot = snapshotMap.get(professionalUserId) ?? {
        rating: 0,
        reviews: 0,
        reviewList: []
      };

      const averageRating = item.count > 0 ? item.sum / item.count : 0;
      currentSnapshot.rating = Number(averageRating.toFixed(1));
      currentSnapshot.reviews = item.count;

      snapshotMap.set(professionalUserId, currentSnapshot);
    });

    return snapshotMap;
  }
}
