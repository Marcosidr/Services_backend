import { Router } from "express";
import { DashboardController } from "../controllers/DashboardController";

const router = Router();

router.get("/", DashboardController.index);
router.post("/messages", DashboardController.createMessage);
router.post("/orders/:orderId/rating", DashboardController.rateOrder);
router.post("/orders/:orderId/cancel", DashboardController.cancelOrder);

export default router;
