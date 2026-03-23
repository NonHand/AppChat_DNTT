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

    // --- TRẠNG THÁI ĐÃ XEM ---
    isRead: {
      type: Boolean,
      default: false, // Dùng chủ yếu cho chat 1-1
    },
    // Cấu trúc readBy dùng cho Group để biết chính xác những ai đã đọc
    readBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      }
    ], 
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
    // Hỗ trợ các trường tương thích cũ
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

// Index cho tính năng tìm kiếm tin nhắn chưa đọc và hiển thị trạng thái
messageSchema.index({ receiverId: 1, isRead: 1 });
messageSchema.index({ "readBy.user": 1 }); // Index cho mảng readBy trong Group

const Message = model("Message", messageSchema);

export default Message;