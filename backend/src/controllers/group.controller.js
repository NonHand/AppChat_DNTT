import Group from "../models/group.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.model.js";
import { decrypt } from "../lib/encryption.js";

export const createGroup = async (req, res) => {
  try {
    const { name, members, groupAvatar } = req.body;
    const adminId = req.user._id;

    let imageUrl = "";
    if (groupAvatar) {
      const uploadResponse = await cloudinary.uploader.upload(groupAvatar);
      imageUrl = uploadResponse.secure_url;
    }

    const newGroup = new Group({
      name,
      admin: adminId,
      members: [...members, adminId],
      groupAvatar: imageUrl,
    });

    await newGroup.save();
    newGroup.members.forEach((memberId) => {
      const memberSocketId = getReceiverSocketId(memberId);
      if (memberSocketId) {
        io.to(memberSocketId).emit("newGroupCreated", newGroup);
      }
    });
    res.status(201).json(newGroup);
  } catch (error) {
    console.log("Error in createGroup: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- HÀM ĐÃ CẬP NHẬT: Thêm đếm tin nhắn chưa đọc cho Group ---
export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // 1. Tìm các nhóm mà user hiện tại là thành viên
    const groups = await Group.find({ members: { $in: [userId] } }).lean();

    // 2. Với mỗi nhóm, xử lý tin nhắn cuối và ĐẾM TIN CHƯA ĐỌC
    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        // Lấy tin nhắn cuối cùng
        const lastMessage = await Message.findOne({ groupId: group._id })
          .sort({ createdAt: -1 })
          .populate("senderId", "fullName")
          .lean();

        // TÍNH NĂNG FIX LỖI: Đếm tin nhắn chưa đọc trong nhóm
        // Điều kiện: Tin nhắn trong group, không phải do mình gửi, và mình chưa có trong mảng readBy
        const unreadCount = await Message.countDocuments({
          groupId: group._id,
          senderId: { $ne: userId },
          "readBy.user": { $ne: userId },
        });

        let processedLastMessage = null;
        if (lastMessage) {
          processedLastMessage = { ...lastMessage };
          if (processedLastMessage.text) {
            processedLastMessage.text = decrypt(processedLastMessage.text);
          }
        }

        return {
          ...group,
          unreadCount, // Trả về số lượng tin nhắn chưa đọc
          lastMessage: processedLastMessage,
          lastMsgTime: lastMessage ? lastMessage.createdAt : group.createdAt,
        };
      })
    );

    // 3. Sắp xếp: Nhóm có tin nhắn mới nhất lên đầu
    groupsWithDetails.sort((a, b) => new Date(b.lastMsgTime) - new Date(a.lastMsgTime));

    res.status(200).json(groupsWithDetails);
  } catch (error) {
    console.log("Error in getGroups: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.members = group.members.filter((member) => member.toString() !== userId.toString());

    if (group.admin.toString() === userId.toString()) {
      if (group.members.length > 0) {
        group.admin = group.members[0];
      } else {
        await Group.findByIdAndDelete(groupId);
        return res.status(200).json({ message: "Group deleted because no members left" });
      }
    }

    await group.save();

    io.to(groupId).emit("userLeftGroup", { groupId, userId });

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    console.log("Error in leaveGroup: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};