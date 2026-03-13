import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import usersRouter from "./routes/users.routes";
import { initDatabase } from "./config/database";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "Backend rodando" });
});

app.use("/api/users", usersRouter);

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exitCode = 1;
});

