import type { Sequelize } from "sequelize";
import { initUserModel, User } from "./User";

export function initModels(sequelize: Sequelize) {
  initUserModel(sequelize);
}

export { User };

