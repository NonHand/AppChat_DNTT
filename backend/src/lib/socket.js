import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

// Khởi tạo Socket.io với cấu hình CORS linh hoạt cho Production
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
      console.log(`📞 Call from ${name} (${from}) to ${userToCall}`);
      io.to(receiverSocketId).emit("incomingCall", { 
        signal: signalData, 
        from: from, // Đây là User ID của người gọi (authUser._id)
        name 
      });
    }
  });

  // 2. Trả lời cuộc gọi
  socket.on("answerCall", (data) => {
    // Tìm socketId của người gọi dựa trên User ID (data.to)
    const callerSocketId = getReceiverSocketId(data.to) || data.to; 
    if (callerSocketId) {
      io.to(callerSocketId).emit("callAccepted", data.signal);
    }
  });

  // 3. Trao đổi thông tin mạng (ICE Candidates) - ĐÃ FIX LỖI KẾT NỐI
  socket.on("ice-candidate", (data) => {
    // Kiểm tra xem data.to là UserId hay là SocketId trực tiếp
    const targetSocketId = userSocketMap[data.to] || data.to;
    
    if (targetSocketId) {
      // Gửi candidate cho đối phương
      io.to(targetSocketId).emit("ice-candidate", { candidate: data.candidate });
    }
  });

  // 4. Kết thúc và LƯU LỊCH SỬ CUỘC GỌI
  socket.on("endCall", async ({ to, duration, senderId }) => {
    const targetSocketId = userSocketMap[to] || to;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("endCall");
    }

    // Lưu vào Database lịch sử cuộc gọi
    try {
      if (senderId && to) {
        // 'to' có thể là socketId, nếu vậy hãy tìm UserId tương ứng
        let receiverId = to;
        for (const [id, sId] of Object.entries(userSocketMap)) {
          if (sId === to) {
            receiverId = id;
            break;
          }
        }

        const callMessage = new Message({
          senderId: senderId,
          receiverId: receiverId,
          messageType: "video_call",
          text: duration > 0 ? "Cuộc gọi video" : "Cuộc gọi nhỡ",
          callDetails: {
            status: duration > 0 ? "completed" : "missed",
            duration: duration || 0,
          },
        });

        await callMessage.save();

        const receiverSocketId = getReceiverSocketId(receiverId);
        const senderSocketId = getReceiverSocketId(senderId);

        if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", callMessage);
        if (senderSocketId) io.to(senderSocketId).emit("newMessage", callMessage);
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