import { Schema, model } from "mongoose";

const messageSchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false, // Dùng false vì có thể là tin nhắn nhóm
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "video_call", "voice", "file", "call"], 
      default: "text",
    },
    text: {
      type: String,
    },
    // --- PHẦN HÌNH ẢNH ---
    image: {
      type: String, // Lưu ảnh đơn lẻ (tương thích cũ)
    },
    images: {
      type: [String], // Mảng lưu trữ nhiều ảnh (tính năng mới)
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

    // --- TRẠNG THÁI ĐÃ XEM (MỚI THÊM) ---
    isRead: {
      type: Boolean,
      default: false, // Dùng cho chat 1-1
    },
    readBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      }
    ], // Dùng cho chat Group (ai đã xem vào lúc nào)
    // ----------------------------------

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
// Index cho tính năng tìm kiếm tin nhắn chưa đọc
messageSchema.index({ receiverId: 1, isRead: 1 });

const Message = model("Message", messageSchema);

export default Message;