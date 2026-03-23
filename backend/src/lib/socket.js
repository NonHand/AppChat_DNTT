import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

// Cấu hình CORS linh hoạt
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" 
      ? [process.env.CLIENT_URL] 
      : ["http://localhost:5173"],
  },
});

// Lưu trữ danh sách người dùng online: {userId: socketId}
const userSocketMap = {}; 

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log(`User connected: ${userId} (Socket: ${socket.id})`);
  }

  // Gửi danh sách online
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ==========================================
  // LOGIC VIDEO CALL (WEBRTC SIGNALING)
  // ==========================================

  // 1. Gửi lời mời gọi
  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
    const receiverSocketId = getReceiverSocketId(userToCall);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incomingCall", { 
        signal: signalData, 
        from: from, // User ID của người gọi
        name 
      });
    }
  });

  // 2. Trả lời cuộc gọi
  socket.on("answerCall", (data) => {
    const callerSocketId = getReceiverSocketId(data.to) || data.to; 
    if (callerSocketId) {
      io.to(callerSocketId).emit("callAccepted", data.signal);
    }
  });

  // 3. ICE Candidates - PHẦN QUAN TRỌNG ĐỂ CÓ VIDEO 2 CHIỀU
  socket.on("ice-candidate", (data) => {
    // Luôn ưu tiên tìm SocketId từ UserId để gửi chính xác
    const targetSocketId = userSocketMap[data.to] || data.to;
    
    if (targetSocketId) {
      // Gửi object chứa key candidate để FE bóc tách dễ dàng
      io.to(targetSocketId).emit("ice-candidate", { 
        candidate: data.candidate 
      });
    }
  });

  // 4. Kết thúc và Lưu tin nhắn Log
  socket.on("endCall", async ({ to, duration, senderId }) => {
    const targetSocketId = userSocketMap[to] || to;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("endCall");
    }

    // Logic lưu vào DB
    try {
      if (senderId && to) {
        // Đảm bảo lấy được MongoDB ID (receiverUserId)
        let receiverUserId = to;
        for (const [uId, sId] of Object.entries(userSocketMap)) {
          if (sId === to) {
            receiverUserId = uId;
            break;
          }
        }

        const callMessage = new Message({
          senderId: senderId,
          receiverId: receiverUserId,
          messageType: "video_call",
          text: duration > 0 ? "Cuộc gọi video" : "Cuộc gọi nhỡ",
          callDetails: {
            status: duration > 0 ? "completed" : "missed",
            duration: duration || 0,
          },
        });

        await callMessage.save();

        // Phát tin nhắn mới cho cả 2 để update UI chat
        const receiverSocketId = getReceiverSocketId(receiverUserId);
        const senderSocketId = getReceiverSocketId(senderId);

        if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", callMessage);
        if (senderSocketId) io.to(senderSocketId).emit("newMessage", callMessage);
      }
    } catch (error) {
      console.error("Error saving call log:", error);
    }
  });

  // ==========================================
  // LOGIC CHAT NHÓM (Giữ nguyên)
  // ==========================================
  socket.on("joinGroup", (groupId) => {
    socket.join(groupId);
  });

  socket.on("leaveGroup", (groupId) => {
    socket.leave(groupId);
  });

  // ==========================================
  // DISCONNECT (Giữ nguyên)
  // ==========================================
  socket.on("disconnect", () => {
    if (userId) {
      console.log(`User disconnected: ${userId}`);
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };