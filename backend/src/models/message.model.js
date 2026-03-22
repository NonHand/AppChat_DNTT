import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    messageType: {
      type: String,
      // Thống nhất dùng "video_call" cho đồng bộ với socket.js
      enum: ["text", "image", "video_call", "voice", "file"], 
      default: "text",
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    audio: {
      type: String,
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number, 
      default: null,
    },

    // --- CẤU TRÚC CUỘC GỌI TẬP TRUNG ---
    callDetails: {
      status: { 
        type: String, 
        enum: ["missed", "completed", "rejected", null], 
        default: null 
      },
      duration: { 
        type: Number, // Tính bằng giây (dễ tính toán hơn)
        default: 0 
      },
      // Thêm để biết là gọi Video hay Voice
      type: {
        type: String,
        enum: ["video", "voice", null],
        default: "video"
      }
    },
  },
  { timestamps: true }
);

// Index giúp truy vấn lịch sử chat nhanh hơn
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;