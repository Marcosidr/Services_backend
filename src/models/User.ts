import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize
} from "sequelize";
import type { Category } from "./Category";
import type { Professional } from "./ProfessionalProfile";

type UserAttributes = InferAttributes<User, { omit: "createdAt" | "updatedAt" | "categories" }>;
type UserCreationAttributes = InferCreationAttributes<
  User,
  { omit: "id" | "createdAt" | "updatedAt" | "categories" }
>;

export class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare cpf: string | null;
  declare phone: string | null;
  declare password: string | null;
  declare role: CreationOptional<"user" | "professional" | "admin">;
  declare categories?: NonAttribute<Category[]>;
  declare professional?: NonAttribute<Professional>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initUserModel(sequelize: Sequelize) {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      email: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
      },
      cpf: {
        type: DataTypes.STRING(11),
        allowNull: true,
        unique: true,
        validate: {
          is: /^\d{11}$/
        }
      },
      phone: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "user",
        validate: {
          isIn: [["user", "professional", "admin"]]
        }
      }
    },
    {
      sequelize,
      tableName: "users"
    }
  );

  return User;
}
