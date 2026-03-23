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
      // Đã cập nhật đầy đủ các loại để khớp với controller
      enum: ["text", "image", "video_call", "voice", "file", "call"], 
      default: "text",
    },
    text: {
      type: String,
    },
    // --- PHẦN HÌNH ẢNH ---
    image: {
      type: String, // Lưu ảnh đầu tiên hoặc ảnh đơn lẻ (tương thích cũ)
    },
    images: {
      type: [String], // Mảng lưu trữ nhiều ảnh cùng lúc (tính năng mới)
      default: [],
    },
    // ---------------------
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
        type: Number, // Tính bằng giây
        default: 0 
      },
      type: {
        type: String,
        enum: ["video", "voice", null],
        default: "video"
      }
    },
    // Hỗ trợ trường duration dạng chuỗi nếu controller cũ vẫn dùng (ví dụ: "00:15")
    duration: {
      type: String,
      default: null
    },
    callType: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Index giúp truy vấn lịch sử chat nhanh hơn
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;