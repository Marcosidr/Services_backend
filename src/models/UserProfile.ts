import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type UserProfileAttributes = InferAttributes<UserProfile, {
  omit: "createdAt" | "updatedAt";
}>;

type UserProfileCreationAttributes = InferCreationAttributes<UserProfile, {
  omit: "id" | "createdAt" | "updatedAt";
}>;

export class UserProfile extends Model<
  UserProfileAttributes,
  UserProfileCreationAttributes
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare photoUrl: string | null;
  declare bio: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initUserProfileModel(sequelize: Sequelize) {
  UserProfile.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      photoUrl: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      sequelize,
      tableName: "user_profiles",
      indexes: [
        {
          unique: true,
          fields: ["userId"]
        }
      ]
    }
  );

  return UserProfile;
}
