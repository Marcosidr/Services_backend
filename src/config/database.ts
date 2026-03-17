import { Sequelize } from "sequelize";
import { initModels } from "../models";

let sequelize: Sequelize | null = null;

export function getSequelize() {
  if (sequelize) return sequelize;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao definido no ambiente.");
  }

  sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

  return sequelize;
}

export async function initDatabase() {
  const sequelizeInstance = getSequelize();

  await sequelizeInstance.authenticate();
  initModels(sequelizeInstance);

  // Evita ALTER automatico por padrao para nao quebrar tipos ENUM ja existentes.
  // Se precisar, ative explicitamente com DB_SYNC_ALTER=true no ambiente.
  const useAlter = process.env.DB_SYNC_ALTER === "true";
  await sequelizeInstance.sync(useAlter ? { alter: true } : undefined);
}
