import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, Plus, Hash } from "lucide-react";
import CreateGroupModal from "./CreateGroupModal";

const Sidebar = () => {
  // Lấy thêm groups và getGroups từ store đã cập nhật
  const { 
    getUsers, users, 
    getGroups, groups, 
    selectedUser, setSelectedUser, 
    isUsersLoading, isGroupsLoading 
  } = useChatStore();
  
  const { onlineUsers } = useAuthStore();
  
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    getUsers();
    getGroups(); // Gọi thêm API lấy danh sách nhóm khi component mount
  }, [getUsers, getGroups]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  if (isUsersLoading || isGroupsLoading) return <SidebarSkeleton />;

  return (
    <>
      <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
        {/* Header Section */}
        <div className="border-b border-base-300 w-full p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-6" />
              <span className="font-medium hidden lg:block">Chats</span>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 hover:bg-base-300 rounded-lg transition-colors group"
              title="Create new group"
            >
              <Plus className="size-5 text-zinc-400 group-hover:text-primary transition-colors" />
            </button>
          </div>

          {/* Online filter toggle */}
          <div className="mt-3 hidden lg:flex items-center gap-2">
            <label className="cursor-pointer flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOnlineOnly}
                onChange={(e) => setShowOnlineOnly(e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm">Show online only</span>
            </label>
          </div>
        </div>

        {/* Danh sách cuộn */}
        <div className="overflow-y-auto w-full py-3">
          
          {/* --- SECTION: GROUPS --- */}
          {groups.length > 0 && (
            <div className="px-5 mb-2 hidden lg:block">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Groups</span>
            </div>
          )}
          
          {groups.map((group) => (
            <button
              key={group._id}
              onClick={() => setSelectedUser(group)}
              className={`
                w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors
                ${selectedUser?._id === group._id ? "bg-base-300 ring-1 ring-base-300" : ""}
              `}
            >
              <div className="relative mx-auto lg:mx-0">
                {group.groupAvatar ? (
                  <img src={group.groupAvatar} alt={group.name} className="size-12 object-cover rounded-full border border-primary/20" />
                ) : (
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Hash className="size-6 text-primary" />
                  </div>
                )}
              </div>
              <div className="hidden lg:block text-left min-w-0 flex-1">
                <div className="font-medium truncate">{group.name}</div>
                <div className="text-sm text-zinc-400">{group.members?.length} members</div>
              </div>
            </button>
          ))}

          {/* --- SECTION: CONTACTS --- */}
          <div className="px-5 mt-4 mb-2 hidden lg:block">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contacts</span>
          </div>

          {filteredUsers.map((user) => (
            <button
              key={user._id}
              onClick={() => setSelectedUser(user)}
              className={`
                w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors
                ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
              `}
            >
              <div className="relative mx-auto lg:mx-0">
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.fullName}
                  className="size-12 object-cover rounded-full"
                />
                {onlineUsers.includes(user._id) && (
                  <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100" />
                )}
              </div>

              <div className="hidden lg:block text-left min-w-0 flex-1">
                <div className="font-medium truncate">{user.fullName}</div>
                <div className="text-sm text-zinc-400">
                  {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                </div>
              </div>
            </button>
          ))}

          {filteredUsers.length === 0 && groups.length === 0 && (
            <div className="text-center text-zinc-500 py-4">No chats found</div>
          )}
        </div>
      </aside>

      {/* Modal tạo nhóm */}
      {isModalOpen && (
        <CreateGroupModal onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
};

export default Sidebar;