import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

// Khởi tạo Socket.io với cấu hình CORS linh hoạt
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
 * Lấy socketId của một user cụ thể từ UserId (MongoDB _id)
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

  // Thông báo danh sách user đang online cho tất cả mọi người
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

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
        from: from, // Đây là MongoDB _id của người gọi
        name 
      });
    }
  });

  // 2. Trả lời cuộc gọi
  socket.on("answerCall", (data) => {
    // data.to ở đây là User ID của người gọi
    const callerSocketId = getReceiverSocketId(data.to) || data.to; 
    if (callerSocketId) {
      io.to(callerSocketId).emit("callAccepted", data.signal);
    }
  });

  // 3. Trao đổi thông tin mạng (ICE Candidates) - FIX LỖI KẾT NỐI 2 CHIỀU
  socket.on("ice-candidate", (data) => {
    // Tìm socketId dựa trên User ID hoặc dùng trực tiếp nếu nó là socketId
    const targetSocketId = userSocketMap[data.to] || data.to;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", { 
        candidate: data.candidate 
      });
    }
  });

  // 4. Kết thúc và LƯU LỊCH SỬ CUỘC GỌI - FIX LỖI MẤT TIN NHẮN LOG
  socket.on("endCall", async ({ to, duration, senderId }) => {
    // to: ID đối phương, senderId: ID người nhấn kết thúc
    const targetSocketId = userSocketMap[to] || to;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("endCall");
    }

    try {
      if (senderId && to) {
        // Tìm đúng User ID người nhận (phòng trường hợp 'to' là socketId)
        let receiverUserId = to;
        for (const [uId, sId] of Object.entries(userSocketMap)) {
          if (sId === to) {
            receiverUserId = uId;
            break;
          }
        }

        // Tạo bản ghi tin nhắn loại video_call
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

        // Phát tin nhắn mới cho cả 2 bên để cập nhật UI ngay lập tức
        const receiverSocketId = getReceiverSocketId(receiverUserId);
        const senderSocketId = getReceiverSocketId(senderId);

        if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", callMessage);
        if (senderSocketId) io.to(senderSocketId).emit("newMessage", callMessage);
        
        console.log(`💾 Call Log Saved: ${duration}s from ${senderId} to ${receiverUserId}`);
      }
    } catch (error) {
      console.error("❌ Lỗi khi lưu lịch sử cuộc gọi:", error);
    }
  });

  // ==========================================
  // LOGIC CHAT NHÓM & DISCONNECT
  // ==========================================
  socket.on("joinGroup", (groupId) => {
    socket.join(groupId);
  });

  socket.on("leaveGroup", (groupId) => {
    socket.leave(groupId);
  });

  socket.on("disconnect", () => {
    if (userId) {
      console.log(`User disconnected: ${userId}`);
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };