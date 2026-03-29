import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type MessageAttributes = InferAttributes<Message, {
  omit: "createdAt" | "updatedAt";
}>;

type MessageCreationAttributes = InferCreationAttributes<Message, {
  omit: "id" | "createdAt" | "updatedAt" | "isRead";
}>;

export class Message extends Model<MessageAttributes, MessageCreationAttributes> {
  declare id: CreationOptional<number>;
  declare conversationId: number;
  declare senderId: number;
  declare receiverId: number;
  declare message: string;
  declare isRead: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initMessageModel(sequelize: Sequelize) {
  Message.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      conversationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "conversation_id",
        references: {
          model: "conversations",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      senderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "sender_id",
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      receiverId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "receiver_id",
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "read"
      }
    },
    {
      sequelize,
      tableName: "messages",
      indexes: [
        { fields: ["conversation_id"] },
        { fields: ["sender_id"] },
        { fields: ["receiver_id"] },
        { fields: ["read"] },
        { fields: ["createdAt"] }
      ]
    }
  );

  return Message;
}
