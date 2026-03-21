import { X, Users, LogOut, Trash2, Video } from "lucide-react"; // Thêm Video icon
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, leaveGroup, clearChat } = useChatStore();
  const { onlineUsers, socket } = useAuthStore(); // Lấy socket để phát tín hiệu gọi

  // Kiểm tra xem đây có phải là cuộc trò chuyện nhóm không
  const isGroup = !!selectedUser?.members;
  
  // Kiểm tra đối phương có online không
  const isOnline = !isGroup && onlineUsers.includes(selectedUser._id);

  const handleClearChat = () => {
    if (window.confirm("Bạn có chắc chắn muốn xoá TOÀN BỘ tin nhắn trong cuộc trò chuyện này? Không thể hoàn tác!")) {
      clearChat(selectedUser._id);
    }
  };

  const handleLeaveGroup = () => {
    if (window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này?")) {
      leaveGroup(selectedUser._id);
    }
  };

  // Hàm xử lý khi bấm nút Video Call
  const handleVideoCall = () => {
    if (!isOnline) {
      alert("Người dùng này hiện không online để nhận cuộc gọi.");
      return;
    }

    // Gửi tín hiệu ban đầu qua Socket để thông báo cho đối phương
    // (Logic mở Modal và PeerConnection sẽ được handle ở store/component call riêng)
    console.log("Khởi tạo cuộc gọi cho:", selectedUser.fullName);
    
    // Phát sự kiện 'startCall' - Bạn sẽ xử lý sự kiện này ở bước làm Store tiếp theo
    socket.emit("callUser", {
      userToCall: selectedUser._id,
      from: socket.id,
      name: "Bạn", // Hoặc lấy tên thật của bạn từ AuthStore
    });
  };
  
  return (
    <div className="p-2.5 border-b border-base-300 bg-base-100/50 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              {isGroup ? (
                selectedUser.groupAvatar ? (
                  <img src={selectedUser.groupAvatar} alt={selectedUser.name} />
                ) : (
                  <div className="bg-primary/10 h-full w-full flex items-center justify-center">
                    <Users className="size-6 text-primary" />
                  </div>
                )
              ) : (
                <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
              )}
              {/* Chỉ báo Online */}
              {!isGroup && isOnline && (
                <span className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-base-100 rounded-full" />
              )}
            </div>
          </div>

          {/* Chat Info */}
          <div>
            <h3 className="font-medium text-sm md:text-base">
              {isGroup ? selectedUser.name : selectedUser.fullName}
            </h3>
            <p className="text-xs text-base-content/70">
              {isGroup ? (
                `${selectedUser.members?.length} thành viên`
              ) : (
                isOnline ? "Đang hoạt động" : "Ngoại tuyến"
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 md:gap-4">
          
          {/* Nút Video Call - Chỉ hiện khi chat 1-1 */}
          {!isGroup && (
            <button 
              onClick={handleVideoCall}
              className={`p-2 rounded-full transition-colors ${
                isOnline ? "text-primary hover:bg-primary/10" : "text-base-content/30 cursor-not-allowed"
              }`}
              title={isOnline ? "Bắt đầu cuộc gọi video" : "Người dùng đang ngoại tuyến"}
            >
              <Video size={22} />
            </button>
          )}

          {/* Nút Xoá toàn bộ tin nhắn */}
          <button 
            onClick={handleClearChat}
            className="p-2 text-base-content/50 hover:text-error hover:bg-error/10 rounded-full transition-all"
            title="Xoá lịch sử trò chuyện"
          >
            <Trash2 size={20} />
          </button>

          {/* Nút rời nhóm - Chỉ hiển thị nếu là group */}
          {isGroup && (
            <button 
              onClick={handleLeaveGroup}
              className="btn btn-ghost btn-xs md:btn-sm text-error"
              title="Rời nhóm"
            >
              <LogOut size={18} />
            </button>
          )}

          {/* Nút đóng chat */}
          <button 
            className="p-2 hover:bg-base-200 rounded-full transition-colors"
            onClick={() => setSelectedUser(null)}
          >
            <X size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;