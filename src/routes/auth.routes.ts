import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { auth } from "../middlewares/auth";

const router = Router();

router.get("/cpf/:cpf", AuthController.lookupByCpf);
router.get("/me", auth, AuthController.me);
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);

export default router;
