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

// Giải quyết vấn đề __dirname trong ES Modules (Quan trọng cho Deploy)
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

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// --- CẤU HÌNH DEPLOY CHUẨN CHO CẤU TRÚC CỦA BẠN ---
if (process.env.NODE_ENV === "production") {
  // Vì index.js nằm trong backend/src, ta cần đi ra 2 cấp để về Root, rồi vào frontend/dist
  const frontendPath = path.resolve(__dirname, "../../frontend/dist");

  // Log này sẽ hiện trong tab Logs của Render để bạn kiểm tra nếu vẫn lỗi
  console.log("Static files path:", frontendPath);

  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
  connectDB();
});