import { useState, useRef } from "react";
import { X, Users, Camera, Loader2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";

const CreateGroupModal = ({ onClose }) => {
  const { users, createGroup } = useChatStore();
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Xử lý chọn ảnh đại diện nhóm (Base64)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.error("Please select an image file");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setGroupAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return toast.error("Group name is required");
    if (selectedUsers.length < 2) return toast.error("Select at least 2 members");

    setIsSubmitting(true);
    try {
      await createGroup({
        name: groupName.trim(),
        members: selectedUsers,
        groupAvatar: groupAvatar, // Gửi ảnh base64 lên backend xử lý Cloudinary
      });
      onClose();
    } catch (error) {
      console.error("Create group error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-base-100 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-base-300">
        
        {/* Header */}
        <div className="p-4 border-b border-base-300 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h3 className="text-lg font-bold">Create New Group</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-base-200 rounded-full transition-colors">
            <X className="size-6" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Avatar Nhóm */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="size-24 rounded-full border-2 border-primary/20 flex items-center justify-center overflow-hidden bg-base-200">
                {groupAvatar ? (
                  <img src={groupAvatar} alt="Group preview" className="size-full object-cover" />
                ) : (
                  <Users className="size-10 text-base-content/30" />
                )}
              </div>
              <button
                type="button"
                className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-white hover:scale-105 transition-transform"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="size-4" />
              </button>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
            <span className="text-xs text-base-content/60">Group Avatar (Optional)</span>
          </div>

          {/* Tên nhóm */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-semibold">Group Name</span>
            </label>
            <input
              type="text"
              placeholder="What's your group's name?"
              className="input input-bordered w-full focus:input-primary"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* Chọn thành viên */}
          <div className="flex flex-col flex-1 min-h-[200px]">
            <label className="label">
              <span className="label-text font-semibold">Select Members ({selectedUsers.length})</span>
            </label>
            <div className="space-y-1">
              {users.map((user) => (
                <label 
                  key={user._id} 
                  className="flex items-center justify-between p-3 hover:bg-base-200 rounded-xl cursor-pointer transition-colors border border-transparent has-[:checked]:border-primary/30"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={user.profilePic || "/avatar.png"}
                      alt={user.fullName}
                      className="size-10 object-cover rounded-full border border-base-300"
                    />
                    <span className="font-medium text-sm">{user.fullName}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm rounded-full"
                    checked={selectedUsers.includes(user._id)}
                    onChange={() => toggleUser(user._id)}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-300">
          <button 
            onClick={handleCreate}
            className="btn btn-primary w-full text-white"
            disabled={!groupName.trim() || selectedUsers.length < 2 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Group"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;