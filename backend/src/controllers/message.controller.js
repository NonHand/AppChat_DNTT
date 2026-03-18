import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js"; // Đảm bảo bạn đã tạo model này

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// Lấy danh sách user cho Sidebar (giữ nguyên hoặc tùy chỉnh để lấy cả Group)
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Lấy tin nhắn (Xử lý cả 1-1 và Group)
export const getMessages = async (req, res) => {
  try {
    const { id: chatPartnerId } = req.params;
    const myId = req.user._id;

    // Kiểm tra xem ID này là User hay Group
    const isGroup = await Group.exists({ _id: chatPartnerId });

    let messages;
    if (isGroup) {
      // Nếu là group, lấy tất cả tin nhắn có groupId này
      messages = await Message.find({ groupId: chatPartnerId }).populate("senderId", "fullName profilePic");
    } else {
      // Nếu là cá nhân, lấy tin nhắn qua lại giữa 2 người
      messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: chatPartnerId },
          { senderId: chatPartnerId, receiverId: myId },
        ],
      });
    }

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Gửi tin nhắn (Xử lý cả 1-1 và Group)
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverOrGroupId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    // Kiểm tra xem đích đến là Group hay cá nhân
    const isGroup = await Group.exists({ _id: receiverOrGroupId });

    const newMessageData = {
      senderId,
      text,
      image: imageUrl,
    };

    if (isGroup) {
      newMessageData.groupId = receiverOrGroupId;
    } else {
      newMessageData.receiverId = receiverOrGroupId;
    }

    const newMessage = new Message(newMessageData);
    await newMessage.save();

    // XỬ LÝ REALTIME VỚI SOCKET.IO
    if (isGroup) {
      // Gửi cho tất cả mọi người trong "phòng" group này
      // Room này đã được người dùng tham gia (join) qua socket.on("joinGroup")
      io.to(receiverOrGroupId).emit("newMessage", newMessage);
    } else {
      // Gửi 1-1 như cũ
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