import { X, Users } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();

  // Kiểm tra xem đây có phải là cuộc trò chuyện nhóm không
  const isGroup = !!selectedUser?.members;

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              {isGroup ? (
                // Hiển thị ảnh nhóm hoặc icon nhóm mặc định
                selectedUser.groupAvatar ? (
                  <img src={selectedUser.groupAvatar} alt={selectedUser.name} />
                ) : (
                  <div className="bg-primary/10 h-full w-full flex items-center justify-center">
                    <Users className="size-6 text-primary" />
                  </div>
                )
              ) : (
                // Hiển thị avatar user cá nhân
                <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
              )}
            </div>
          </div>

          {/* Chat Info */}
          <div>
            <h3 className="font-medium">{isGroup ? selectedUser.name : selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {isGroup ? (
                `${selectedUser.members?.length} members`
              ) : (
                // Trạng thái online cho cá nhân
                onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"
              )}
            </p>
          </div>
        </div>

        {/* Close button */}
        <button onClick={() => setSelectedUser(null)}>
          <X />
        </button>
      </div>
    </div>
  );
};
export default ChatHeader;