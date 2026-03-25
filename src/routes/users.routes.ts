import { Router } from "express";
import { UsersController } from "../controllers/UsersController";
import { auth } from "../middlewares/auth";

const router = Router();

router.use(auth);

router.get("/", UsersController.index);
router.get("/:id", UsersController.show);
router.post("/", UsersController.store);
router.put("/:id", UsersController.update);
router.delete("/:id", UsersController.destroy);

export default router;

