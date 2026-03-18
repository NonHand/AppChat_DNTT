import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    // Người gửi tin nhắn (luôn bắt buộc)
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Người nhận (chỉ dùng cho chat 1-1, không bắt buộc nếu là chat nhóm)
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Thay đổi thành false để linh hoạt
    },
    // ID của nhóm (chỉ dùng khi gửi tin nhắn vào group)
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group", // Tham chiếu tới model Group bạn sẽ tạo
      default: null,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
  },
  { timestamps: true }
);

// Thêm index để truy vấn tin nhắn nhanh hơn (tùy chọn nhưng nên có)
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;