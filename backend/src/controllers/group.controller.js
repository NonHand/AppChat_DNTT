import Group from "../models/group.model.js";
import cloudinary from "../lib/cloudinary.js";
//import { io } from "../lib/socket.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.model.js";
import { decrypt } from "../lib/encryption.js";
/* export const createGroup = async (req, res) => {
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
      members: [...members, adminId], // Admin tự động là thành viên
      groupAvatar: imageUrl,
    });

    await newGroup.save();
    res.status(201).json(newGroup);
  } catch (error) {
    console.log("Error in createGroup: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    // Tìm các nhóm mà user hiện tại là thành viên
    const groups = await Group.find({ members: { $in: [userId] } });
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}; */

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
        // Gửi sự kiện "newGroupCreated" kèm thông tin nhóm mới
        io.to(memberSocketId).emit("newGroupCreated", newGroup);
      }
    });
    res.status(201).json(newGroup);
  } catch (error) {
    console.log("Error in createGroup: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- HÀM CẬP NHẬT: Lấy danh sách nhóm kèm tin nhắn cuối để sắp xếp ---
export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // 1. Tìm các nhóm mà user hiện tại là thành viên
    const groups = await Group.find({ members: { $in: [userId] } }).lean();

    // 2. Với mỗi nhóm, tìm tin nhắn cuối cùng thuộc nhóm đó
    const groupsWithLastMsg = await Promise.all(
      groups.map(async (group) => {
        const lastMessage = await Message.findOne({ groupId: group._id })
          .sort({ createdAt: -1 })
          .populate("senderId", "fullName")
          .lean();

        // --- ĐOẠN CẦN SỬA/THÊM ---
        let processedLastMessage = null;
        if (lastMessage) {
          processedLastMessage = { ...lastMessage };
          if (processedLastMessage.text) {
            // Giải mã tin nhắn cuối cùng của nhóm tại đây
            processedLastMessage.text = decrypt(processedLastMessage.text);
          }
        }

        return {
          ...group,
          lastMessage:processedLastMessage,
          // Nếu có tin nhắn dùng thời gian tin nhắn, nếu chưa có dùng thời gian tạo nhóm
          lastMsgTime: lastMessage ? lastMessage.createdAt : group.createdAt,
        };
      })
    );

    // 3. Sắp xếp: Nhóm có tin nhắn mới nhất (lastMsgTime lớn nhất) lên đầu
    groupsWithLastMsg.sort((a, b) => new Date(b.lastMsgTime) - new Date(a.lastMsgTime));

    res.status(200).json(groupsWithLastMsg);
  } catch (error) {
    console.log("Error in getGroups: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Thêm export mới vào file group.controller.js
export const leaveGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Cập nhật mảng members bằng cách loại bỏ userId
    group.members = group.members.filter((member) => member.toString() !== userId.toString());

    // Nếu người rời đi là Admin, chuyển quyền cho người đầu tiên còn lại (nếu có)
    if (group.admin.toString() === userId.toString()) {
      if (group.members.length > 0) {
        group.admin = group.members[0];
      } else {
        // Nếu không còn ai, có thể chọn xoá nhóm hoặc để admin trống
        await Group.findByIdAndDelete(groupId);
        return res.status(200).json({ message: "Group deleted because no members left" });
      }
    }

    await group.save();

    // Thông báo cho các thành viên khác trong nhóm qua Socket
    io.to(groupId).emit("userLeftGroup", { groupId, userId });

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    console.log("Error in leaveGroup: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};