import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

// --- Logic LocalStorage để giữ số đếm khi F5 ---
const getStoredUnreadCounts = () => {
  try {
    const stored = localStorage.getItem("unreadCounts");
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {};
  }
};

const setStoredUnreadCounts = (counts) => {
  localStorage.setItem("unreadCounts", JSON.stringify(counts));
};

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  groups: [],
  selectedUser: null,
  // Khởi tạo từ ổ cứng thay vì object rỗng
  unreadCounts: getStoredUnreadCounts(), 
  isUsersLoading: false,
  isMessagesLoading: false,
  isGroupsLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi tải danh sách người dùng");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
      
      const socket = useAuthStore.getState().socket;
      if (socket) {
        res.data.forEach(group => {
          socket.emit("joinGroup", group._id);
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi tải nhóm");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  getMessages: async (chatId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${chatId}`);
      set({ messages: res.data });
      // Đánh dấu đã đọc khi mở chat
      get().markAsRead(chatId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi tải tin nhắn");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, users, groups } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      const newMessage = res.data;

      set({ messages: [...messages, newMessage] });

      if (newMessage.groupId) {
        const updatedGroups = groups.map(g => 
          g._id === newMessage.groupId ? { ...g, lastMessage: newMessage } : g
        ).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ groups: [...updatedGroups] });
      } else {
        const updatedUsers = users.map(u => 
          u._id === selectedUser._id ? { ...u, lastMessage: newMessage } : u
        ).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ users: [...updatedUsers] });
      }
      return newMessage;
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi gửi tin nhắn");
    }
  },

  subscribeToChatUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newGroupCreated");
    socket.off("newMessage");

    socket.on("newGroupCreated", (newGroup) => {
      const { groups } = get();
      if (!groups.some((g) => g._id === newGroup._id)) {
        set({ groups: [newGroup, ...groups] });
        socket.emit("joinGroup", newGroup._id);
        if (newGroup.admin !== useAuthStore.getState().authUser._id) {
          toast.success(`Nhóm mới: ${newGroup.name}`);
        }
      }
    });

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, users, groups, messages, unreadCounts } = get();
      const authUser = useAuthStore.getState().authUser;
      if (!authUser) return;

      const currentChatId = selectedUser?._id?.toString();
      const msgGroupId = newMessage.groupId?.toString();
      const msgSenderId = (newMessage.senderId._id || newMessage.senderId).toString();
      const msgReceiverId = newMessage.receiverId?.toString();
      
      const chatIdOfIncomingMsg = msgGroupId || msgSenderId;

      const isChatRelevant = msgGroupId 
        ? msgGroupId === currentChatId 
        : (msgSenderId === currentChatId || (msgSenderId === authUser._id.toString() && msgReceiverId === currentChatId));

      if (isChatRelevant && msgSenderId !== authUser._id.toString()) {
        set({ messages: [...messages, newMessage] });
      } 
      
      // --- CẬP NHẬT ĐẾM TIN NHẮN (Đồng bộ LocalStorage) ---
      if (msgSenderId !== authUser._id.toString() && chatIdOfIncomingMsg !== currentChatId) {
        const newCounts = {
          ...unreadCounts,
          [chatIdOfIncomingMsg]: (unreadCounts[chatIdOfIncomingMsg] || 0) + 1,
        };
        set({ unreadCounts: newCounts });
        setStoredUnreadCounts(newCounts); // Lưu vào localStorage
      }

      // Cập nhật Sidebar Realtime
      if (msgGroupId) {
        const updatedGroups = groups.map((g) => 
          g._id.toString() === msgGroupId ? { ...g, lastMessage: newMessage } : g
        ).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ groups: [...updatedGroups] });
      } else {
        const partnerId = msgSenderId === authUser._id.toString() ? msgReceiverId : msgSenderId;
        const updatedUsers = users.map((u) => 
          u._id.toString() === partnerId ? { ...u, lastMessage: newMessage } : u
        ).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ users: [...updatedUsers] });
      }
    });
  },

  markAsRead: (chatId) => {
    const { unreadCounts } = get();
    if (unreadCounts[chatId]) {
      const newCounts = { ...unreadCounts, [chatId]: 0 };
      set({ unreadCounts: newCounts });
      setStoredUnreadCounts(newCounts); // Cập nhật lại localStorage
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;
    const socket = useAuthStore.getState().socket;
    if (selectedUser.members) socket.emit("joinGroup", selectedUser._id);
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
  },

  createGroup: async (groupData) => {
    try {
      const res = await axiosInstance.post("/groups/create", groupData);
      toast.success("Tạo nhóm thành công!");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tạo nhóm");
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/delete/${messageId}`);
      set({ messages: get().messages.filter((m) => m._id !== messageId) });
      toast.success("Đã xoá tin nhắn");
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể xoá tin nhắn");
    }
  },

  clearChat: async (chatId) => {
    try {
      await axiosInstance.delete(`/messages/clear/${chatId}`);
      set({ messages: [] });
      toast.success("Đã xoá toàn bộ tin nhắn");
    } catch (error) {
      toast.error("Không thể xoá cuộc trò chuyện");
    }
  },

  leaveGroup: async (groupId) => {
    try {
      await axiosInstance.post(`/groups/leave/${groupId}`);
      set({
        groups: get().groups.filter((g) => g._id !== groupId),
        selectedUser: null,
      });
      toast.success("Đã rời khỏi nhóm");
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi rời nhóm");
    }
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser });
    if (selectedUser) {
      get().markAsRead(selectedUser._id);
    }
  },
}));