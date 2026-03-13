import { Sequelize } from "sequelize";
import { initModels } from "../models";

let sequelize: Sequelize | null = null;

export function getSequelize() {
  if (sequelize) return sequelize;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definido no ambiente.");
  }

  sequelize = new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false
  });

  return sequelize;
}

export async function initDatabase() {
  const sequelizeInstance = getSequelize();

  await sequelizeInstance.authenticate();
  initModels(sequelizeInstance);

  // Para iniciar rápido o desenvolvimento sem migrations.
  // Depois você pode trocar por migrations com sequelize-cli.
  await sequelizeInstance.sync();
}
