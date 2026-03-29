import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import usersRouter from "./routes/users.routes";
import authRouter from "./routes/auth.routes";
import dashboardRouter from "./routes/dashboard.routes";
import categoryRouter from "./routes/categories.router";
import professionalsRouter from "./routes/professionals.routes";
import adminRouter from "./routes/admin.routes";
import messagesRouter from "./routes/messages.routes";
import notificationsRouter from "./routes/notifications.routes";
import { initDatabase } from "./config/database";




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

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "Backend online" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/professionals", professionalsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/notifications", notificationsRouter);


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
