import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  groups: [], // Thêm state lưu danh sách nhóm
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
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Lấy danh sách nhóm người dùng đã tham gia
  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi tải nhóm");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  getMessages: async (chatId) => {
    set({ isMessagesLoading: true });
    try {
      // API này giờ đã xử lý cả userId và groupId ở Backend
      const res = await axiosInstance.get(`/messages/${chatId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      // Gửi đến route đã định nghĩa với ID của User hoặc Group
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  // Tạo nhóm mới
  createGroup: async (groupData) => {
    try {
      const res = await axiosInstance.post("/groups/create", groupData);
      set({ groups: [...get().groups, res.data] });
      toast.success("Tạo nhóm thành công!");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tạo nhóm");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    // Nếu đang chọn một nhóm, yêu cầu socket tham gia vào room nhóm đó
    if (selectedUser.members) {
      socket.emit("joinGroup", selectedUser._id);
    }

    socket.on("newMessage", (newMessage) => {
      const { selectedUser } = get();
      if (!selectedUser) return;

      // Logic kiểm tra tin nhắn có thuộc về cuộc hội thoại hiện tại không:
      // 1. Nếu là tin nhắn nhóm: groupId của tin nhắn phải khớp với ID nhóm đang chọn
      // 2. Nếu là tin nhắn cá nhân: senderId của tin nhắn phải khớp với ID người đang chọn
      const isChatRelevant = newMessage.groupId 
        ? newMessage.groupId === selectedUser._id 
        : newMessage.senderId === selectedUser._id;

      if (!isChatRelevant) return;

      set({
        messages: [...get().messages, newMessage],
      });
    });
  },

  unsubscribeFromMessages: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    
    if (selectedUser?.members) {
      socket.emit("leaveGroup", selectedUser._id);
    }
    
    socket.off("newMessage");
  },

  // Cập nhật selectedUser (Dùng chung cho cả User và Group để đồng bộ giao diện)
  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));