import Group from "../models/group.model.js";
import cloudinary from "../lib/cloudinary.js";

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
};