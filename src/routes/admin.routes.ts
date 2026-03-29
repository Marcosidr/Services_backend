import { Router } from "express";
import { AdminController } from "../controllers/AdminController";
import { CategoryController } from "../controllers/CategoriesController";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireRole";

const router = Router();

router.use(auth);
router.use(requireAdmin);

router.get("/dashboard", AdminController.dashboard);
router.post("/professionals/:id/approve", AdminController.approveProfessional);
router.post("/professionals/:id/reject", AdminController.rejectProfessional);
router.get("/categories", CategoryController.adminIndex);
router.post("/categories", CategoryController.store);
router.put("/categories/:id", CategoryController.update);
router.delete("/categories/:id", CategoryController.destroy);
router.get("/announcements", AdminController.listAnnouncements);
router.post("/announcements", AdminController.createAnnouncement);
router.put("/announcements/:id", AdminController.updateAnnouncement);
router.delete("/announcements/:id", AdminController.deleteAnnouncement);

export default router;
