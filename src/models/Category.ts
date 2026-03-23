import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize
} from "sequelize";
import type { User } from "./User";

type CategoryAttributes = InferAttributes<Category, {
  omit: "createdAt" | "updatedAt" | "users";
}>;

type CategoryCreationAttributes = InferCreationAttributes<Category, {
  omit: "id" | "createdAt" | "updatedAt" | "users";
}>;

export class Category extends Model<CategoryAttributes, CategoryCreationAttributes> {
  declare id: CreationOptional<number>;
  declare slug: string;
  declare icon: string | null;
  declare label: string;
  declare is_active: CreationOptional<boolean>;
  declare users?: NonAttribute<User[]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initCategoryModel(sequelize: Sequelize) {
  Category.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      slug: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true
      },
      label: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true
      },
      icon: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      sequelize,
      tableName: "categories"
    }
  );

  return Category;
}
