import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    // Người gửi tin nhắn (luôn bắt buộc)
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Người nhận (chỉ dùng cho chat 1-1)
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    // ID của nhóm (chỉ dùng khi gửi tin nhắn vào group)
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    // Phân loại tin nhắn để xử lý hiển thị khác nhau ở FE
    messageType: {
      type: String,
      // Bổ sung "file" và "call" vào enum để đồng bộ với controller
      enum: ["text", "image", "video_call", "voice", "file", "call"], 
      default: "text",
    },
    // Nội dung văn bản
    text: {
      type: String,
    },
    // Đường dẫn ảnh (Cloudinary)
    image: {
      type: String,
    },
    // Đường dẫn âm thanh (Cloudinary URL)
    audio: {
      type: String,
    },

    // --- CÁC TRƯỜNG BỔ SUNG CHO CHỨC NĂNG GỬI FILE ---
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number, // Tính bằng bytes
      default: null,
    },

    // --- CÁC TRƯỜNG BỔ SUNG CHO CUỘC GỌI ---
    duration: { 
      type: String, // Lưu dạng "02:15" để hiển thị nhanh
      default: null 
    },
    callType: { 
      type: String, 
      enum: ["video", "audio", null], 
      default: null 
    },
    
    // Giữ nguyên callDetails cũ để tương thích với các tin nhắn cũ trong DB
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
    },
  },
  { timestamps: true }
);

// Thêm index để truy vấn tin nhắn nhanh hơn
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;