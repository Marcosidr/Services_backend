        import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type UserAttributes = InferAttributes<User, { omit: "createdAt" | "updatedAt" }>;
type UserCreationAttributes = InferCreationAttributes<
  User,
  { omit: "id" | "createdAt" | "updatedAt" }
>;

export class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare email: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initUserModel(sequelize: Sequelize) {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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
      }
    },
    {
      sequelize,
      tableName: "users"
    }
  );

  return User;
}
