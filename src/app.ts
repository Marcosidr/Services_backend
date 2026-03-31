import cors from "cors";
import express from "express";
import usersRouter from "./routes/users.routes";
import authRouter from "./routes/auth.routes";
import dashboardRouter from "./routes/dashboard.routes";
import categoryRouter from "./routes/categories.router";
import professionalsRouter from "./routes/professionals.routes";
import adminRouter from "./routes/admin.routes";
import messagesRouter from "./routes/messages.routes";
import notificationsRouter from "./routes/notifications.routes";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
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

  return app;
}

export const app = createApp();
