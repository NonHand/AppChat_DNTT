import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { 
  getMessages, 
  getUsersForSidebar, 
  sendMessage, 
  deleteMessage, 
  clearChat,
  saveCallNotification,
  markMessagesAsRead // Import hàm mới để xử lý trạng thái đã xem
} from "../controllers/message.controller.js";

const router = express.Router();

// Lấy danh sách người dùng cho sidebar
router.get("/users", protectRoute, getUsersForSidebar);

// Lấy lịch sử tin nhắn với một người dùng hoặc nhóm cụ thể
router.get("/:id", protectRoute, getMessages);

// Gửi tin nhắn mới (văn bản, hình ảnh, audio, file)
router.post("/send/:id", protectRoute, sendMessage);

// Đánh dấu tất cả tin nhắn từ một người dùng cụ thể là đã đọc
router.put("/read/:id", protectRoute, markMessagesAsRead);

// Route: Lưu thông báo kết thúc cuộc gọi và bắn Socket Realtime
router.post("/call-notification/:id", protectRoute, saveCallNotification);

// Xóa một tin nhắn cụ thể
router.delete("/delete/:id", protectRoute, deleteMessage);

// Xóa toàn bộ lịch sử trò chuyện
router.delete("/clear/:id", protectRoute, clearChat);

export default router;