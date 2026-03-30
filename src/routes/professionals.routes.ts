import { Router } from "express";
import { ProfessionalsController } from "../controllers/ProfessionalsController";
import { auth } from "../middlewares/auth";

const router = Router();

router.get("/", ProfessionalsController.index);
router.post("/register", ProfessionalsController.register);
router.post("/upgrade", auth, ProfessionalsController.upgradeFromUser);
router.get("/me", auth, ProfessionalsController.me);
router.patch("/me", auth, ProfessionalsController.updateMyProfile);
router.get("/:id", ProfessionalsController.show);

export default router;
