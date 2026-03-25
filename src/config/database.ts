import { Sequelize } from "sequelize";
import { Category, initModels } from "../models";

let sequelize: Sequelize | null = null;

const defaultCategories = [
  { slug: "PINTOR", label: "Pintor", icon: "paint", is_active: true },
  { slug: "PEDREIRO", label: "Pedreiro", icon: "brick", is_active: true },
  { slug: "ELETRICISTA", label: "Eletricista", icon: "bolt", is_active: true },
  { slug: "ENCANADOR", label: "Encanador", icon: "pipe", is_active: true },
  { slug: "GESSEIRO", label: "Gesseiro", icon: "tool", is_active: true },
  { slug: "MARCENEIRO", label: "Marceneiro", icon: "saw", is_active: true },
  { slug: "SERRALHEIRO", label: "Serralheiro", icon: "wrench", is_active: true },
  { slug: "VIDRACEIRO", label: "Vidraceiro", icon: "glass", is_active: true },
  { slug: "CHAVEIRO", label: "Chaveiro", icon: "key", is_active: true },
  { slug: "JARDINEIRO", label: "Jardineiro", icon: "leaf", is_active: true },
  { slug: "MONTADOR_MOVEIS", label: "Montador de Moveis", icon: "furniture", is_active: true },
  {
    slug: "TECNICO_AR_CONDICIONADO",
    label: "Tecnico de Ar Condicionado",
    icon: "fan",
    is_active: true
  },
  { slug: "TECNICO_INFORMATICA", label: "Tecnico de Informatica", icon: "computer", is_active: true },
  { slug: "DIARISTA", label: "Diarista", icon: "clean", is_active: true },
  { slug: "REPAROS_GERAIS", label: "Reparos Gerais", icon: "hammer", is_active: true }
] as const;

async function migrateLegacyProfessionals(sequelizeInstance: Sequelize) {
  const migrationQuery = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'professional_profiles'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'professionals'
  ) THEN
    INSERT INTO professionals (
      "userId",
      cpf,
      description,
      experience,
      price,
      "priceUnit",
      "areaKm",
      cep,
      city,
      online,
      verified,
      "approvalStatus",
      "photoUrl",
      "createdAt",
      "updatedAt"
    )
    SELECT
      pp."userId",
      regexp_replace(pp.cpf, '\\\\D', '', 'g'),
      pp.description,
      pp.experience,
      pp.price,
      pp."priceUnit",
      pp."areaKm",
      pp.cep,
      pp.city,
      pp.online,
      pp.verified,
      pp."approvalStatus",
      pp."photoUrl",
      pp."createdAt",
      pp."updatedAt"
    FROM professional_profiles pp
    WHERE pp.cpf IS NOT NULL
      AND regexp_replace(pp.cpf, '\\\\D', '', 'g') <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM professionals p
        WHERE p."userId" = pp."userId"
      )
      AND NOT EXISTS (
        SELECT 1
        FROM professionals p
        WHERE p.cpf = regexp_replace(pp.cpf, '\\\\D', '', 'g')
      );
  END IF;
END $$;
`;

  await sequelizeInstance.query(migrationQuery);
}

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
  await migrateLegacyProfessionals(sequelizeInstance);

  const categoryCount = await Category.count();
  if (categoryCount === 0) {
    await Category.bulkCreate(defaultCategories);
  }
}
