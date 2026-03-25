import type { Sequelize } from "sequelize";
import { initUserModel, User } from "./User";
import { initCategoryModel, Category } from "./Category";
import { initUserCategoryModel, UserCategory } from "./UserCategory";
import { initProfessionalModel, Professional } from "./ProfessionalProfile";

export function initModels(sequelize: Sequelize) {
  initUserModel(sequelize);
  initCategoryModel(sequelize);
  initUserCategoryModel(sequelize);
  initProfessionalModel(sequelize);

  User.belongsToMany(Category, {
    through: UserCategory,
    foreignKey: "userId",
    otherKey: "categoryId",
    as: "categories"
  });

  Category.belongsToMany(User, {
    through: UserCategory,
    foreignKey: "categoryId",
    otherKey: "userId",
    as: "users"
  });

  User.hasOne(Professional, {
    foreignKey: "userId",
    as: "professional"
  });

  Professional.belongsTo(User, {
    foreignKey: "userId",
    as: "user"
  });
}

export { User };
export { Category };
export { UserCategory };
export { Professional };
