import { Router } from "express";
import { MessagesController } from "../controllers/MessagesController";
import { auth } from "../middlewares/auth";

const router = Router();

router.use(auth);

router.get("/conversations", MessagesController.conversations);
router.get("/", MessagesController.index);
router.post("/", MessagesController.store);
router.put("/:id", MessagesController.update);
router.patch("/:id/read", MessagesController.markAsRead);
router.delete("/conversations/with-user/:userId", MessagesController.destroyConversationWithUser);
router.delete("/conversations/:id", MessagesController.destroyConversation);
router.delete("/:id", MessagesController.destroy);

export default router;
