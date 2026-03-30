import { Router } from "express";
import { DashboardController } from "../controllers/DashboardController";
import { auth } from "../middlewares/auth";

const router = Router();

router.use(auth);

router.get("/", DashboardController.index);
router.post("/orders", DashboardController.createOrder);
router.post("/messages", DashboardController.createMessage);
router.post("/orders/:orderId/accept", DashboardController.acceptOrder);
router.post("/orders/:orderId/reject", DashboardController.rejectOrder);
router.post("/orders/:orderId/complete", DashboardController.completeOrder);
router.post("/orders/:orderId/rating", DashboardController.rateOrder);
router.post("/orders/:orderId/cancel", DashboardController.cancelOrder);

export default router;
