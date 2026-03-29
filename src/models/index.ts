import type { Sequelize } from "sequelize";
import { initUserModel, User } from "./User";
import { initCategoryModel, Category } from "./Category";
import { initUserCategoryModel, UserCategory } from "./UserCategory";
import { initProfessionalModel, Professional } from "./ProfessionalProfile";
import { initNotificationModel, Notification } from "./Notification";
import { Conversation, initConversationModel } from "./Conversation";
import { initMessageModel, Message } from "./Message";

export function initModels(sequelize: Sequelize) {
  initUserModel(sequelize);
  initCategoryModel(sequelize);
  initUserCategoryModel(sequelize);
  initProfessionalModel(sequelize);
  initNotificationModel(sequelize);
  initConversationModel(sequelize);
  initMessageModel(sequelize);

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

  User.hasMany(Notification, {
    foreignKey: "userId",
    as: "notifications"
  });

  Notification.belongsTo(User, {
    foreignKey: "userId",
    as: "user"
  });

  User.hasMany(Conversation, {
    foreignKey: "user1",
    as: "conversationsAsUser1"
  });

  User.hasMany(Conversation, {
    foreignKey: "user2",
    as: "conversationsAsUser2"
  });

  Conversation.belongsTo(User, {
    foreignKey: "user1",
    as: "participantOne"
  });

  Conversation.belongsTo(User, {
    foreignKey: "user2",
    as: "participantTwo"
  });

  Conversation.hasMany(Message, {
    foreignKey: "conversationId",
    as: "messages"
  });

  Message.belongsTo(Conversation, {
    foreignKey: "conversationId",
    as: "conversation"
  });

  User.hasMany(Message, {
    foreignKey: "senderId",
    as: "sentMessages"
  });

  User.hasMany(Message, {
    foreignKey: "receiverId",
    as: "receivedMessages"
  });

  Message.belongsTo(User, {
    foreignKey: "senderId",
    as: "sender"
  });

  Message.belongsTo(User, {
    foreignKey: "receiverId",
    as: "recipient"
  });
}

export { User };
export { Category };
export { UserCategory };
export { Professional };
export { Notification };
export { Conversation };
export { Message };
