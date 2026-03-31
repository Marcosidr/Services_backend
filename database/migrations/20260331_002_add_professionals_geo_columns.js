"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE "professionals"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
`);

    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS "professionals_location_idx"
ON "professionals" ("latitude", "longitude");
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS "professionals_location_idx";
`);

    await queryInterface.sequelize.query(`
ALTER TABLE "professionals"
  DROP COLUMN IF EXISTS "latitude",
  DROP COLUMN IF EXISTS "longitude";
`);
  }
};
