import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

// Cấu hình CORS linh hoạt cho Production và Local
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" 
      ? [process.env.CLIENT_URL] 
      : ["http://localhost:5173"],
  },
});

// Lưu trữ danh sách người dùng online: {userId: socketId}
const userSocketMap = {}; 

/**
 * Lấy socketId từ UserId (MongoDB _id)
 */
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log(`User connected: ${userId} (Socket: ${socket.id})`);
  }

  // Gửi danh sách online cho tất cả mọi người
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ==========================================
  // LOGIC ĐÃ XEM (SEEN RECEIPTS) - MỚI THÊM
  // ==========================================
  
  // Khi người dùng mở chat, FE sẽ emit sự kiện này
  socket.on("markAsRead", ({ senderId, receiverId }) => {
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      // Báo cho người gửi biết rằng người nhận đã xem
      io.to(senderSocketId).emit("messagesRead", {
        chatPartnerId: receiverId, // ID của người vừa xem tin nhắn
        readBy: receiverId
      });
    }
  });

  // ==========================================
  // LOGIC VIDEO CALL (WEBRTC SIGNALING)
  // ==========================================

  // 1. Gửi lời mời gọi
  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
    const receiverSocketId = getReceiverSocketId(userToCall);
    if (receiverSocketId) {
      console.log(`📞 Call Request: From ${name} to ${userToCall}`);
      io.to(receiverSocketId).emit("incomingCall", { 
        signal: signalData, 
        from: from, // User ID người gọi
        name 
      });
    }
  });

  // 2. Xử lý khi máy nhận đang bận
  socket.on("call-busy", ({ to }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      console.log(`🚫 User is busy: ${to}`);
      io.to(callerSocketId).emit("user-busy");
    }
  });

  // 3. Trả lời cuộc gọi
  socket.on("answerCall", (data) => {
    const callerSocketId = getReceiverSocketId(data.to) || data.to; 
    if (callerSocketId) {
      io.to(callerSocketId).emit("callAccepted", data.signal);
    }
  });

  // 4. Trao đổi ICE Candidates (Địa chỉ mạng)
  socket.on("ice-candidate", (data) => {
    const targetSocketId = userSocketMap[data.to] || data.to;
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", { 
        candidate: data.candidate 
      });
    }
  });

  // 5. Kết thúc cuộc gọi & Lưu Log
  socket.on("endCall", async ({ to, duration, senderId }) => {
    const targetSocketId = userSocketMap[to] || to;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("endCall");
    }

    try {
      if (senderId && to) {
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

        const receiverSocketId = getReceiverSocketId(receiverUserId);
        const senderSocketId = getReceiverSocketId(senderId);

        if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", callMessage);
        if (senderSocketId) io.to(senderSocketId).emit("newMessage", callMessage);
      }
    } catch (error) {
      console.error("❌ Error saving call log:", error);
    }
  });

  // ==========================================
  // LOGIC CHAT NHÓM
  // ==========================================
  socket.on("joinGroup", (groupId) => {
    socket.join(groupId);
  });

  socket.on("leaveGroup", (groupId) => {
    socket.leave(groupId);
  });

  // ==========================================
  // DISCONNECT
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