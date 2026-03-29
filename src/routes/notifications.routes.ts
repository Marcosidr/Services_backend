import { Router } from "express";
import { NotificationsController } from "../controllers/NotificationsController";
import { auth } from "../middlewares/auth";

const router = Router();

router.use(auth);

router.get("/", NotificationsController.index);
router.get("/unread-count", NotificationsController.unreadCount);
router.patch("/read-all", NotificationsController.markAllAsRead);
router.patch("/:id/read", NotificationsController.markAsRead);
router.delete("/:id", NotificationsController.destroy);

export default router;
