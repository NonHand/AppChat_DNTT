import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js"; 
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// --- 1. CẤU HÌNH MIDDLEWARE ---
app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// Cập nhật CORS linh hoạt
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" 
      ? process.env.CLIENT_URL 
      : "http://localhost:5173",
    credentials: true,
  })
);

// --- 2. CÁC ROUTE API ---
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// --- 3. CẤU HÌNH DEPLOY (SERVING FRONTEND) ---
if (process.env.NODE_ENV === "production") {
  // Sử dụng path.resolve để đảm bảo đường dẫn tuyệt đối chính xác trên Linux của Render
  const frontendPath = path.resolve(__dirname, "..", "frontend", "dist");

  // Kiểm tra log xem đường dẫn có đúng không (xem trong Render Logs)
  console.log("Serving static files from:", frontendPath);

  app.use(express.static(frontendPath));

  // Mọi request không phải API sẽ trả về index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// --- 4. KHỞI CHẠY SERVER ---
server.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  connectDB();
});