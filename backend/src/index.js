import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js"; 
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT || 5001;

// --- GIẢI QUYẾT ĐƯỜNG DẪN (Đã tối ưu cho cấu trúc của bạn) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.NODE_ENV === "production" 
      ? process.env.CLIENT_URL 
      : "http://localhost:5173",
    credentials: true,
  })
);

// Các API Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// --- CẤU HÌNH PHỤC VỤ FRONTEND (DEPLOY) ---
if (process.env.NODE_ENV === "production") {
  // Đi từ backend/src ra ngoài 2 cấp để tới thư mục gốc dự án
  const rootPath = path.resolve(__dirname, "../../");
  const frontendPath = path.join(rootPath, "frontend", "dist");

  // In ra Log để kiểm tra trên Render (Cực kỳ quan trọng để debug)
  console.log("Checking Frontend Path:", frontendPath);

  // Phục vụ các file tĩnh trong thư mục dist
  app.use(express.static(frontendPath));

  // Trả về index.html cho mọi request không phải API
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
  console.log(`Working Directory: ${process.cwd()}`);
  connectDB();
});