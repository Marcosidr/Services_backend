import { Router } from "express";
import { ProfessionalsController } from "../controllers/ProfessionalsController";
import { auth } from "../middlewares/auth";

const router = Router();

router.post("/register", ProfessionalsController.register);
router.post("/upgrade", auth, ProfessionalsController.upgradeFromUser);
router.get("/:id", ProfessionalsController.show);

export default router;
