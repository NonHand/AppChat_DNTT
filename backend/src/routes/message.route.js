import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage,deleteMessage, clearChat } from "../controllers/message.controller.js";
const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage);
// Thêm dòng này vào cuối danh sách router
router.delete("/delete/:id", protectRoute, deleteMessage);

router.delete("/clear/:id", protectRoute, clearChat); //
export default router;
