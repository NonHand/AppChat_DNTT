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

// --- HÀM SEND MESSAGE: HỖ TRỢ GỬI NHIỀU ẢNH ---
export const sendMessage = async (req, res) => {
  try {
    const { text, image, images, audio, file, fileName, fileSize } = req.body;
    const { id: receiverOrGroupId } = req.params;
    const senderId = req.user._id;

    // 1. Xử lý Upload Ảnh (Hỗ trợ cả đơn lẻ 'image' cũ và mảng 'images' mới)
    let imageUrls = [];
    
    // Nếu gửi mảng nhiều ảnh
    if (images && Array.isArray(images) && images.length > 0) {
      const uploadPromises = images.map((img) => cloudinary.uploader.upload(img));
      const uploadResponses = await Promise.all(uploadPromises);
      imageUrls = uploadResponses.map((res) => res.secure_url);
    } 
    // Nếu gửi 1 ảnh duy nhất (giữ logic cũ cho mobile/các version cũ)
    else if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrls = [uploadResponse.secure_url];
    }

    // 2. Xử lý Audio
    let audioUrl;
    if (audio) {
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "video",
        folder: "voice_messages",
      });
      audioUrl = uploadResponse.secure_url;
    }

    // 3. Xử lý File tài liệu
    let fileUrl;
    if (file) {
      const uploadResponse = await cloudinary.uploader.upload(file, {
        resource_type: "auto",
        folder: "chat_files",
      });
      fileUrl = uploadResponse.secure_url;
    }

    const isGroup = await Group.exists({ _id: receiverOrGroupId });

    // 4. Mã hóa nội dung văn bản
    const encryptedText = text ? encrypt(text) : text;

    const newMessageData = {
      senderId,
      text: encryptedText,
      // Lưu ảnh vào cả trường đơn lẻ (ảnh đầu tiên) và trường mảng (tất cả ảnh)
      image: imageUrls.length > 0 ? imageUrls[0] : null, 
      images: imageUrls, 
      audio: audioUrl,
      fileUrl: fileUrl,
      fileName: fileName,
      fileSize: fileSize,
      messageType: fileUrl ? "file" : audio ? "voice" : imageUrls.length > 0 ? "image" : "text",
    };

    if (isGroup) {
      newMessageData.groupId = receiverOrGroupId;
    } else {
      newMessageData.receiverId = receiverOrGroupId;
    }

    const newMessage = new Message(newMessageData);
    await newMessage.save();

    // 5. Chuẩn bị dữ liệu gửi Realtime (Bản rõ để hiển thị ngay)
    const messageToSend = newMessage.toObject();
    messageToSend.text = text; 

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

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;
    const message = await Message.findById(messageId);

    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Xóa nhiều ảnh trên Cloudinary
    if (message.images && message.images.length > 0) {
      const deletePromises = message.images.map((img) => {
        const publicId = img.split("/").pop().split(".")[0];
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