import { Router } from "express";
import { ProfessionalsController } from "../controllers/ProfessionalsController";

const router = Router();

router.post("/register", ProfessionalsController.register);
router.post("/upgrade", ProfessionalsController.upgradeFromUser);
router.get("/:id", ProfessionalsController.show);

export default router;
