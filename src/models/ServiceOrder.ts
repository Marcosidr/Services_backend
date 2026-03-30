import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

export type ServiceOrderStatus = "aguardando" | "em andamento" | "concluido" | "cancelado";

type ServiceOrderRecordAttributes = InferAttributes<ServiceOrderRecord, {
  omit: "createdAt" | "updatedAt";
}>;

type ServiceOrderRecordCreationAttributes = InferCreationAttributes<ServiceOrderRecord, {
  omit: "createdAt" | "updatedAt";
}>;

export class ServiceOrderRecord extends Model<
  ServiceOrderRecordAttributes,
  ServiceOrderRecordCreationAttributes
> {
  declare id: string;
  declare requesterUserId: number;
  declare professionalUserId: number;
  declare requesterName: string;
  declare professionalName: string;
  declare category: string;
  declare description: string | null;
  declare orderDate: Date;
  declare price: number | string;
  declare status: ServiceOrderStatus;
  declare rating: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initServiceOrderModel(sequelize: Sequelize) {
  ServiceOrderRecord.init(
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true
      },
      requesterUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "requester_user_id",
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      professionalUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "professional_user_id",
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      requesterName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "requester_name"
      },
      professionalName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "professional_name"
      },
      category: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      orderDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "order_date",
        defaultValue: DataTypes.NOW
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "aguardando",
        validate: {
          isIn: [["aguardando", "em andamento", "concluido", "cancelado"]]
        }
      },
      rating: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        validate: {
          min: 1,
          max: 5
        }
      }
    },
    {
      sequelize,
      tableName: "service_orders",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  );

  return ServiceOrderRecord;
}
