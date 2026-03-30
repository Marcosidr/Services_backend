import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type ProfessionalReviewAttributes = InferAttributes<ProfessionalReview, {
  omit: "createdAt" | "updatedAt";
}>;

type ProfessionalReviewCreationAttributes = InferCreationAttributes<ProfessionalReview, {
  omit: "id" | "createdAt" | "updatedAt";
}>;

export class ProfessionalReview extends Model<
  ProfessionalReviewAttributes,
  ProfessionalReviewCreationAttributes
> {
  declare id: CreationOptional<number>;
  declare professionalUserId: number;
  declare reviewerUserId: number;
  declare orderId: string | null;
  declare rating: number;
  declare comment: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initProfessionalReviewModel(sequelize: Sequelize) {
  ProfessionalReview.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      professionalUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      reviewerUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      orderId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 5
        }
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      sequelize,
      tableName: "professional_reviews",
      indexes: [
        {
          name: "pr_reviews_professional_idx",
          fields: ["professionalUserId"]
        },
        {
          name: "pr_reviews_reviewer_idx",
          fields: ["reviewerUserId"]
        },
        {
          name: "pr_reviews_order_idx",
          fields: ["orderId"]
        },
        {
          name: "pr_reviews_uq_reviewer_prof_order",
          unique: true,
          fields: ["reviewerUserId", "professionalUserId", "orderId"]
        }
      ]
    }
  );

  return ProfessionalReview;
}
