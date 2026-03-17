import { Router } from "express";
import { CategoryController } from "../controllers/CategoriesController";
const router = Router();

router.get("/", CategoryController.index);

export default router;

