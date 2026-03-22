import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { 
  getMessages, 
  getUsersForSidebar, 
  sendMessage, 
  deleteMessage, 
  clearChat,
  saveCallNotification // Thêm hàm này vào để xử lý thông báo cuộc gọi
} from "../controllers/message.controller.js";

const router = express.Router();

// Lấy danh sách người dùng cho sidebar
router.get("/users", protectRoute, getUsersForSidebar);

// Lấy lịch sử tin nhắn với một người dùng hoặc nhóm cụ thể
router.get("/:id", protectRoute, getMessages);

// Gửi tin nhắn mới (văn bản, hình ảnh, audio)
router.post("/send/:id", protectRoute, sendMessage);

// Route mới: Lưu thông báo kết thúc cuộc gọi và bắn Socket Realtime
router.post("/call-notification/:id", protectRoute, saveCallNotification);

// Xóa một tin nhắn cụ thể
router.delete("/delete/:id", protectRoute, deleteMessage);

// Xóa toàn bộ lịch sử trò chuyện
router.delete("/clear/:id", protectRoute, clearChat);

export default router;