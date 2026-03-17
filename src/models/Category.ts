import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type CategoryAttributes = InferAttributes<Category, {
  omit: "createdAt" | "updatedAt";
}>;

type CategoryCreationAttributes = InferCreationAttributes<Category, {
  omit: "id" | "createdAt" | "updatedAt";
}>;

export class Category extends Model<CategoryAttributes, CategoryCreationAttributes> {
  declare id: CreationOptional<string>;
  declare slug: string;
  declare icon: string | null;
  declare label: string;
  declare is_active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initCategoryModel(sequelize: Sequelize) {
  Category.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      slug: {
        type: DataTypes.STRING(120),
        allowNull: false
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