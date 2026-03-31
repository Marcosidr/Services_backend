import dotenv from "dotenv";
import path from "path";
import { initDatabase } from "./config/database";
import { app } from "./app";

const envPath = path.resolve(process.cwd(), ".env");
console.log("Tentando carregar .env em:", envPath);

dotenv.config({ path: envPath });

function maskConnectionString(connectionString?: string) {
  if (!connectionString) return "(nao definida)";
  return connectionString.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

console.log("PORT =", process.env.PORT);
console.log("NODE_ENV =", process.env.NODE_ENV);
console.log("DATABASE_URL =", maskConnectionString(process.env.DATABASE_URL));

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
