import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from "sequelize";

type ProfessionalProfileAttributes = InferAttributes<ProfessionalProfile, {
  omit: "createdAt" | "updatedAt";
}>;

type ProfessionalProfileCreationAttributes = InferCreationAttributes<ProfessionalProfile, {
  omit: "id" | "createdAt" | "updatedAt";
}>;

export class ProfessionalProfile extends Model<
  ProfessionalProfileAttributes,
  ProfessionalProfileCreationAttributes
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare cpf: string | null;
  declare description: string | null;
  declare experience: string | null;
  declare price: number | null;
  declare priceUnit: CreationOptional<string>;
  declare areaKm: CreationOptional<number>;
  declare cep: string | null;
  declare city: string | null;
  declare online: CreationOptional<boolean>;
  declare verified: CreationOptional<boolean>;
  declare approvalStatus: CreationOptional<"pending" | "approved" | "rejected">;
  declare photoUrl: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initProfessionalProfileModel(sequelize: Sequelize) {
  ProfessionalProfile.init(
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
      cpf: {
        type: DataTypes.STRING(18),
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      experience: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      priceUnit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "servico"
      },
      areaKm: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
        validate: {
          min: 1,
          max: 1000
        }
      },
      cep: {
        type: DataTypes.STRING(9),
        allowNull: true
      },
      city: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      online: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      approvalStatus: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        validate: {
          isIn: [["pending", "approved", "rejected"]]
        }
      },
      photoUrl: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      sequelize,
      tableName: "professional_profiles",
      indexes: [
        {
          fields: ["approvalStatus"]
        },
        {
          fields: ["online"]
        }
      ]
    }
  );

  return ProfessionalProfile;
}
