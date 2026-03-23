import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type UserCategoryAttributes = InferAttributes<UserCategory, {
  omit: "createdAt" | "updatedAt";
}>;

type UserCategoryCreationAttributes = InferCreationAttributes<UserCategory, {
  omit: "createdAt" | "updatedAt";
}>;

export class UserCategory extends Model<UserCategoryAttributes, UserCategoryCreationAttributes> {
  declare userId: number;
  declare categoryId: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initUserCategoryModel(sequelize: Sequelize) {
  UserCategory.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "categories",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      }
    },
    {
      sequelize,
      tableName: "user_categories",
      indexes: [
        {
          unique: true,
          fields: ["userId", "categoryId"]
        },
        {
          fields: ["categoryId"]
        }
      ]
    }
  );

  return UserCategory;
}
