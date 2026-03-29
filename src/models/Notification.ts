import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type NotificationAttributes = InferAttributes<Notification, {
  omit: "createdAt" | "updatedAt";
}>;

type NotificationCreationAttributes = InferCreationAttributes<Notification, {
  omit: "id" | "createdAt" | "updatedAt";
}>;

export class Notification extends Model<
  NotificationAttributes,
  NotificationCreationAttributes
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare type: CreationOptional<string>;
  declare title: string;
  declare message: string;
  declare isRead: CreationOptional<boolean>;
  declare metadata: Record<string, unknown> | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initNotificationModel(sequelize: Sequelize) {
  Notification.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      type: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "system"
      },
      title: {
        type: DataTypes.STRING(160),
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true
      }
    },
    {
      sequelize,
      tableName: "notifications",
      indexes: [
        { fields: ["userId"] },
        { fields: ["isRead"] },
        { fields: ["createdAt"] }
      ]
    }
  );

  return Notification;
}
