"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF to_regclass('"professional_reviews_reviewer_user_id_professional_user_id_orde"') IS NOT NULL
     AND to_regclass('"pr_reviews_uq_reviewer_prof_order"') IS NULL THEN
    ALTER INDEX "professional_reviews_reviewer_user_id_professional_user_id_orde"
      RENAME TO "pr_reviews_uq_reviewer_prof_order";
  END IF;
END $$;
`);

    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS "pr_reviews_professional_idx"
ON "professional_reviews" ("professionalUserId");
`);
    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS "pr_reviews_reviewer_idx"
ON "professional_reviews" ("reviewerUserId");
`);
    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS "pr_reviews_order_idx"
ON "professional_reviews" ("orderId");
`);
    await queryInterface.sequelize.query(`
CREATE UNIQUE INDEX IF NOT EXISTS "pr_reviews_uq_reviewer_prof_order"
ON "professional_reviews" ("reviewerUserId", "professionalUserId", "orderId");
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS "pr_reviews_uq_reviewer_prof_order";
`);
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS "pr_reviews_order_idx";
`);
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS "pr_reviews_reviewer_idx";
`);
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS "pr_reviews_professional_idx";
`);
  }
};
