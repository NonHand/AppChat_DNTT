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
      // Thêm "voice" vào danh sách enum
      enum: ["text", "image", "video_call", "voice"], 
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
    // Đường dẫn âm thanh (Cloudinary URL hoặc Base64 tạm thời)
    audio: {
      type: String,
    },
    // Thông tin bổ sung cho cuộc gọi (Thời lượng, Trạng thái)
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