import { Router } from "express";
import { DashboardController } from "../controllers/DashboardController";
import { auth } from "../middlewares/auth";

const router = Router();

router.use(auth);

router.get("/", DashboardController.index);
router.post("/messages", DashboardController.createMessage);
router.post("/orders/:orderId/rating", DashboardController.rateOrder);
router.post("/orders/:orderId/cancel", DashboardController.cancelOrder);

export default router;
