import { Router } from "express";
import { AuthController } from "../controllers/AuthController";

const router = Router();

router.get("/cpf/:cpf", AuthController.lookupByCpf);
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);

export default router;
