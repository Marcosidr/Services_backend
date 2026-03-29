import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type ConversationAttributes = InferAttributes<Conversation, {
  omit: "createdAt" | "updatedAt";
}>;

type ConversationCreationAttributes = InferCreationAttributes<Conversation, {
  omit: "id" | "createdAt" | "updatedAt";
}>;

export class Conversation extends Model<
  ConversationAttributes,
  ConversationCreationAttributes
> {
  declare id: CreationOptional<number>;
  declare user1: number;
  declare user2: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initConversationModel(sequelize: Sequelize) {
  Conversation.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user1: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      user2: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      }
    },
    {
      sequelize,
      tableName: "conversations",
      indexes: [
        {
          unique: true,
          fields: ["user1", "user2"]
        },
        { fields: ["user1"] },
        { fields: ["user2"] }
      ]
    }
  );

  return Conversation;
}
