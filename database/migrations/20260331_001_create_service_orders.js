"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS "service_orders" (
  "id" VARCHAR(64) PRIMARY KEY,
  "requester_user_id" INTEGER NOT NULL REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "professional_user_id" INTEGER NOT NULL REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "requester_name" VARCHAR(255) NOT NULL,
  "professional_name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(255) NOT NULL,
  "description" TEXT NULL,
  "order_date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "price" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'aguardando',
  "rating" SMALLINT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "service_orders_status_check" CHECK ("status" IN ('aguardando', 'em andamento', 'concluido', 'cancelado')),
  CONSTRAINT "service_orders_rating_check" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5))
);
`);

    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS "service_orders_requester_idx"
ON "service_orders" ("requester_user_id");
`);
    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS "service_orders_professional_idx"
ON "service_orders" ("professional_user_id");
`);
    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS "service_orders_status_idx"
ON "service_orders" ("status");
`);
    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS "service_orders_order_date_idx"
ON "service_orders" ("order_date");
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS "service_orders";
`);
  }
};
