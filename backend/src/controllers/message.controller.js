import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const users = await User.find({ _id: { $ne: loggedInUserId } }).select("-password").lean();

    const usersWithLastMsg = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: user._id },
            { senderId: user._id, receiverId: loggedInUserId },
          ],
        }).sort({ createdAt: -1 });

        return {
          ...user,
          lastMessage: lastMessage ? lastMessage : null,
          lastMsgTime: lastMessage ? lastMessage.createdAt : user.createdAt,
        };
      })
    );

    usersWithLastMsg.sort((a, b) => new Date(b.lastMsgTime) - new Date(a.lastMsgTime));
    res.status(200).json(usersWithLastMsg);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: chatPartnerId } = req.params;
    const myId = req.user._id;

    const isGroup = await Group.exists({ _id: chatPartnerId });

    let messages;
    if (isGroup) {
      messages = await Message.find({ groupId: chatPartnerId })
        .populate("senderId", "fullName profilePic")
        .sort({ createdAt: 1 });
    } else {
      messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: chatPartnerId },
          { senderId: chatPartnerId, receiverId: myId },
        ],
      }).sort({ createdAt: 1 });
    }

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Gửi tin nhắn (Cập nhật hỗ trợ: Image, Audio, và FILE TÀI LIỆU)
export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, file, fileName, fileSize } = req.body;
    const { id: receiverOrGroupId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl;
    if (audio) {
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "video",
        folder: "voice_messages",
      });
      audioUrl = uploadResponse.secure_url;
    }

    // XỬ LÝ UPLOAD FILE (PDF, Docx, Zip...)
    let fileUrl;
    if (file) {
      const uploadResponse = await cloudinary.uploader.upload(file, {
        resource_type: "auto", // Quan trọng: auto để nhận diện mọi loại file
        folder: "chat_files",
      });
      fileUrl = uploadResponse.secure_url;
    }

    const isGroup = await Group.exists({ _id: receiverOrGroupId });

    const newMessageData = {
      senderId,
      text,
      image: imageUrl,
      audio: audioUrl,
      fileUrl: fileUrl,
      fileName: fileName,
      fileSize: fileSize,
      messageType: fileUrl ? "file" : audio ? "voice" : image ? "image" : "text",
    };

    if (isGroup) {
      newMessageData.groupId = receiverOrGroupId;
    } else {
      newMessageData.receiverId = receiverOrGroupId;
    }

    const newMessage = new Message(newMessageData);
    await newMessage.save();

    // SOCKET REALTIME
    if (isGroup) {
      io.to(receiverOrGroupId).emit("newMessage", newMessage);
    } else {
      const receiverSocketId = getReceiverSocketId(receiverOrGroupId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;
    const message = await Message.findById(messageId);

    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Xóa ảnh trên Cloudinary
    if (message.image) {
      const publicId = message.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }
    // Xóa audio trên Cloudinary
    if (message.audio) {
      const publicId = message.audio.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
    }
    // Xóa file tài liệu trên Cloudinary
    if (message.fileUrl) {
      const publicId = "chat_files/" + message.fileUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId, { resource_type: "raw" }); 
    }

    await Message.findByIdAndDelete(messageId);

    const targetId = message.groupId || message.receiverId;
    if (message.groupId) {
      io.to(targetId.toString()).emit("messageDeleted", messageId);
    } else {
      const receiverSocketId = getReceiverSocketId(targetId);
      if (receiverSocketId) io.to(receiverSocketId).emit("messageDeleted", messageId);
    }

    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.log("Error in deleteMessage: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const clearChat = async (req, res) => {
  try {
    const { id: chatId } = req.params;
    const myId = req.user._id;

    const isGroup = await Group.exists({ _id: chatId });

    if (isGroup) {
      await Message.deleteMany({ groupId: chatId });
    } else {
      await Message.deleteMany({
        $or: [
          { senderId: myId, receiverId: chatId },
          { senderId: chatId, receiverId: myId },
        ],
      });
    }

    io.to(chatId).emit("chatCleared", chatId); 
    res.status(200).json({ message: "Chat cleared" });
  } catch (error) {
    console.log("Error in clearChat: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * HÀM BỔ SUNG: Lưu thông báo kết thúc cuộc gọi
 */
export const saveCallNotification = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const { duration, callType } = req.body;
    const senderId = req.user._id;

    const isMissedCall = duration === "00:00";
    const callText = isMissedCall 
      ? `Cuộc gọi ${callType === "video" ? "video" : "thoại"} nhỡ`
      : `Cuộc gọi ${callType === "video" ? "video" : "thoại"} kết thúc. Thời lượng: ${duration}`;

    const newMessage = new Message({
      senderId,
      receiverId,
      text: callText,
      duration: duration || "00:00",
      callType: callType || "video",
      messageType: "call", // Đổi sang "call" cho đồng bộ Model enum
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in saveCallNotification: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};