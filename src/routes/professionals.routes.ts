import { Router } from "express";
import { ProfessionalsController } from "../controllers/ProfessionalsController";

const router = Router();

router.post("/register", ProfessionalsController.register);
router.get("/:id", ProfessionalsController.show);

export default router;
