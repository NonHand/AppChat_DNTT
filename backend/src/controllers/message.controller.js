import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { decrypt, encrypt } from "../lib/encryption.js";

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
        }).sort({ createdAt: -1 }).lean();

        let processedLastMessage = null;
        if (lastMessage) {
          processedLastMessage = { ...lastMessage };
          if (processedLastMessage.text) {
            processedLastMessage.text = decrypt(processedLastMessage.text);
          }
        }

        return {
          ...user,
          lastMessage: processedLastMessage,
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
      // Đánh dấu mình đã xem các tin nhắn trong group trước khi lấy dữ liệu
      await Message.updateMany(
        { groupId: chatPartnerId, "readBy.user": { $ne: myId } },
        { $push: { readBy: { user: myId } } }
      );

      messages = await Message.find({ groupId: chatPartnerId })
        .populate("senderId", "fullName profilePic")
        .populate("readBy.user", "fullName profilePic") // Lấy thông tin người đã xem
        .sort({ createdAt: 1 });

      // Phát socket báo cho mọi người trong group rằng mình đã xem
      io.to(chatPartnerId).emit("messagesRead", {
        chatId: chatPartnerId,
        readBy: await User.findById(myId).select("fullName profilePic"),
        isGroup: true
      });

    } else {
      messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: chatPartnerId },
          { senderId: chatPartnerId, receiverId: myId },
        ],
      })
      .populate("readBy.user", "fullName profilePic")
      .sort({ createdAt: 1 });

      // Tự động đánh dấu đã xem khi lấy tin nhắn cá nhân
      await Message.updateMany(
        { senderId: chatPartnerId, receiverId: myId, isRead: false },
        { isRead: true }
      );

      const receiverSocketId = getReceiverSocketId(chatPartnerId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messagesRead", {
          readBy: myId,
          chatPartnerId: myId,
        });
      }
    }

    const decryptedMessages = messages.map((msg) => {
      const messageObj = msg.toObject();
      if (messageObj.text) {
        messageObj.text = decrypt(messageObj.text);
      }
      return messageObj;
    });

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, images, audio, file, fileName, fileSize } = req.body;
    const { id: receiverOrGroupId } = req.params;
    const senderId = req.user._id;

    let imageUrls = [];
    if (images && Array.isArray(images) && images.length > 0) {
      const uploadPromises = images.map((img) => cloudinary.uploader.upload(img));
      const uploadResponses = await Promise.all(uploadPromises);
      imageUrls = uploadResponses.map((res) => res.secure_url);
    } else if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrls = [uploadResponse.secure_url];
    }

    let audioUrl;
    if (audio) {
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "video",
        folder: "voice_messages",
      });
      audioUrl = uploadResponse.secure_url;
    }

    let fileUrl;
    if (file) {
      const uploadResponse = await cloudinary.uploader.upload(file, {
        resource_type: "auto",
        folder: "chat_files",
      });
      fileUrl = uploadResponse.secure_url;
    }

    const isGroup = await Group.exists({ _id: receiverOrGroupId });
    const encryptedText = text ? encrypt(text) : text;

    const newMessageData = {
      senderId,
      text: encryptedText,
      image: imageUrls.length > 0 ? imageUrls[0] : null, 
      images: imageUrls, 
      audio: audioUrl,
      fileUrl: fileUrl,
      fileName: fileName,
      fileSize: fileSize,
      messageType: fileUrl ? "file" : audio ? "voice" : imageUrls.length > 0 ? "image" : "text",
      isRead: false,
    };

    if (isGroup) {
      newMessageData.groupId = receiverOrGroupId;
      newMessageData.readBy = [{ user: senderId }]; // Đổi userId thành user theo model mới
    } else {
      newMessageData.receiverId = receiverOrGroupId;
    }

    const newMessage = new Message(newMessageData);
    await newMessage.save();

    // Populate sender info để client hiển thị ngay
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("senderId", "fullName profilePic")
      .populate("readBy.user", "fullName profilePic");

    const messageToSend = populatedMessage.toObject();
    messageToSend.text = text; // Gửi text đã giải mã cho socket

    if (isGroup) {
      io.to(receiverOrGroupId).emit("newMessage", messageToSend);
    } else {
      const receiverSocketId = getReceiverSocketId(receiverOrGroupId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", messageToSend);
      }
    }

    res.status(201).json(messageToSend);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: chatId } = req.params;
    const myId = req.user._id;

    const isGroup = await Group.exists({ _id: chatId });

    if (isGroup) {
      await Message.updateMany(
        { groupId: chatId, "readBy.user": { $ne: myId } },
        { $push: { readBy: { user: myId } } }
      );
      
      const userInfo = await User.findById(myId).select("fullName profilePic");
      io.to(chatId).emit("messagesRead", {
        chatId,
        readBy: userInfo,
        isGroup: true
      });
    } else {
      await Message.updateMany(
        { senderId: chatId, receiverId: myId, isRead: false },
        { isRead: true }
      );

      const receiverSocketId = getReceiverSocketId(chatId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messagesRead", {
          readBy: myId,
          chatPartnerId: myId,
        });
      }
    }

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Error in markMessagesAsRead: ", error.message);
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

    // Xử lý xóa file trên Cloudinary (giữ nguyên logic của bạn)
    if (message.images && message.images.length > 0) {
      const deletePromises = message.images.map((img) => {
        const parts = img.split("/");
        const publicId = parts[parts.length - 1].split(".")[0];
        return cloudinary.uploader.destroy(publicId);
      });
      await Promise.all(deletePromises);
    } else if (message.image) {
      const publicId = message.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }

    if (message.audio) {
      const publicId = message.audio.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
    }
    
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
      messageType: "call",
      isRead: false,
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