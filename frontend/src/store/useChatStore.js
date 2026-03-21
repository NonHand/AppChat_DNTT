import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  groups: [],
  selectedUser: null,
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

      // Cập nhật khung chat ngay lập tức cho người gửi
      set({ messages: [...messages, newMessage] });

      // Cập nhật Sidebar cho người gửi (đưa lên đầu)
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
      const { selectedUser, users, groups, messages } = get();
      const authUser = useAuthStore.getState().authUser;
      if (!authUser) return;

      // Ép kiểu ID về String để so sánh chính xác (tránh lỗi Object ID từ populate)
      const currentChatId = selectedUser?._id?.toString();
      const msgGroupId = newMessage.groupId?.toString();
      const msgSenderId = (newMessage.senderId._id || newMessage.senderId).toString();
      const msgReceiverId = newMessage.receiverId?.toString();

      // 1. Cập nhật khung chat nếu đang mở đúng cuộc trò chuyện
      const isChatRelevant = msgGroupId 
        ? msgGroupId === currentChatId 
        : (msgSenderId === currentChatId || (msgSenderId === authUser._id.toString() && msgReceiverId === currentChatId));

      if (isChatRelevant && msgSenderId !== authUser._id.toString()) {
        set({ messages: [...messages, newMessage] });
      }

      // 2. Cập nhật Sidebar Realtime (Dành cho người nhận)
      if (msgGroupId) {
        const updatedGroups = groups.map((g) => 
          g._id.toString() === msgGroupId ? { ...g, lastMessage: newMessage } : g
        ).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ groups: [...updatedGroups] });
      } else {
        // Xác định đối tác (Partner) để cập nhật đúng dòng trên Sidebar
        const partnerId = msgSenderId === authUser._id.toString() ? msgReceiverId : msgSenderId;
        const updatedUsers = users.map((u) => 
          u._id.toString() === partnerId ? { ...u, lastMessage: newMessage } : u
        ).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ users: [...updatedUsers] });
      }
    });
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

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));