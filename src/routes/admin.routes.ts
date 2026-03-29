import { Router } from "express";
import { AdminController } from "../controllers/AdminController";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireRole";

const router = Router();

router.use(auth);
router.use(requireAdmin);

router.get("/dashboard", AdminController.dashboard);
router.post("/professionals/:id/approve", AdminController.approveProfessional);
router.post("/professionals/:id/reject", AdminController.rejectProfessional);

export default router;
