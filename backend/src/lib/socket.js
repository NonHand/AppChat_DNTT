import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

// Khởi tạo Socket.io với cấu hình CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

// Lưu trữ danh sách người dùng online: {userId: socketId}
const userSocketMap = {}; 

/**
 * Lấy socketId của một user cụ thể
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
      console.log(`Call from ${name} to ${userToCall}`);
      io.to(receiverSocketId).emit("incomingCall", { 
        signal: signalData, 
        from, // Đây là socketId của người gọi
        userId: userId, // Đây là MongoDB _id của người gọi
        name 
      });
    }
  });

  // 2. Trả lời cuộc gọi
  socket.on("answerCall", (data) => {
    const callerSocketId = getReceiverSocketId(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("callAccepted", data.signal);
    }
  });

  // 3. Trao đổi thông tin mạng (ICE Candidates)
  socket.on("ice-candidate", (data) => {
    const targetSocketId = getReceiverSocketId(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", data.candidate);
    }
  });

  // 4. Kết thúc và LƯU LỊCH SỬ CUỘC GỌI
  socket.on("endCall", async ({ to, duration, senderId }) => {
    // 'to' ở đây có thể là userId (MongoDB _id) hoặc socketId tùy theo FE gửi lên
    // Để an toàn, chúng ta tìm socketId từ userId nếu cần
    const targetSocketId = userSocketMap[to] || to;
    
    // Thông báo cho bên kia cúp máy
    if (targetSocketId) {
      io.to(targetSocketId).emit("endCall");
    }

    // Lưu vào Database lịch sử cuộc gọi
    try {
      if (senderId && to) {
        const callMessage = new Message({
          senderId: senderId,
          receiverId: to,
          messageType: "video_call",
          text: duration > 0 ? "Cuộc gọi video" : "Cuộc gọi nhỡ",
          callDetails: {
            status: duration > 0 ? "completed" : "missed",
            duration: duration || 0,
          },
        });

        await callMessage.save();

        // Phát tín hiệu tin nhắn mới để FE cập nhật khung chat ngay lập tức
        const receiverIdInMap = getReceiverSocketId(to);
        const senderIdInMap = getReceiverSocketId(senderId);

        if (receiverIdInMap) io.to(receiverIdInMap).emit("newMessage", callMessage);
        if (senderIdInMap) io.to(senderIdInMap).emit("newMessage", callMessage);
      }
    } catch (error) {
      console.error("Lỗi khi lưu lịch sử cuộc gọi:", error);
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

  // Xử lý ngắt kết nối
  socket.on("disconnect", () => {
    if (userId) {
      console.log(`User disconnected: ${userId}`);
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };