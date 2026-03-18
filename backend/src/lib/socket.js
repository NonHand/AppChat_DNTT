import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

/**
 * Hàm lấy socketId của một user để gửi tin nhắn cá nhân (1-1)
 *
 */
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// Lưu trữ người dùng đang online: {userId: socketId}
//
const userSocketMap = {}; 

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log(`User connected: ${userId} (Socket: ${socket.id})`);
  }

  // Gửi danh sách user online cho tất cả client
  //
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // --- LOGIC CHO CHAT NHÓM (NEW) ---

  // Khi người dùng vào một cuộc trò chuyện nhóm
  socket.on("joinGroup", (groupId) => {
    socket.join(groupId);
    console.log(`User ${userId} joined group room: ${groupId}`);
  });

  // Khi người dùng thoát khỏi cửa sổ chat nhóm
  socket.on("leaveGroup", (groupId) => {
    socket.leave(groupId);
    console.log(`User ${userId} left group room: ${groupId}`);
  });

  // ---------------------------------

  socket.on("disconnect", () => {
    if (userId) {
      console.log("A user disconnected", socket.id);
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };