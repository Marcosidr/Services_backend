import type { Sequelize } from "sequelize";
import { initUserModel, User } from "./User";
import { initCategoryModel, Category} from "./Category";

export function initModels(sequelize: Sequelize) {
  initUserModel(sequelize);
}

export { User };
export {Category}
