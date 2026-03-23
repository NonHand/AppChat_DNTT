import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

// Biến global để quản lý Interval nhấp nháy tiêu đề
let flashTitleInterval = null;

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
  unreadCounts: getStoredUnreadCounts(),
  isUsersLoading: false,
  isMessagesLoading: false,
  isGroupsLoading: false,

  getUsers: async () => {
    if (get().users.length === 0) set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error("Lỗi tải danh sách người dùng");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getGroups: async () => {
    if (get().groups.length === 0) set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
      const socket = useAuthStore.getState().socket;
      if (socket) {
        res.data.forEach((group) => {
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
      // Khi lấy tin nhắn, tự động đánh dấu đã xem
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
        const updatedGroups = groups
          .map((g) => (g._id === newMessage.groupId ? { ...g, lastMessage: newMessage } : g))
          .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ groups: updatedGroups });
      } else {
        const updatedUsers = users
          .map((u) => (u._id === selectedUser._id ? { ...u, lastMessage: newMessage } : u))
          .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ users: updatedUsers });
      }
      return newMessage;
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi gửi tin nhắn");
    }
  },

  saveCallLog: async (receiverId, callData) => {
    const { messages, users, selectedUser } = get();
    const authUser = useAuthStore.getState().authUser;

    try {
      const res = await axiosInstance.post(`/messages/call-notification/${receiverId}`, callData);
      const newMessage = {
        ...res.data,
        senderId: authUser._id,
      };

      if (selectedUser?._id === receiverId) {
        set({ messages: [...messages, newMessage] });
      }

      const updatedUsers = users
        .map((u) => (u._id === receiverId ? { ...u, lastMessage: newMessage } : u))
        .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));

      set({ users: updatedUsers });
      return newMessage;
    } catch (error) {
      console.error("Lỗi khi lưu log cuộc gọi:", error);
    }
  },

  subscribeToChatUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newGroupCreated");
    socket.off("newMessage");
    socket.off("messagesRead");
    socket.off("messageDeleted");

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

    // --- LẮNG NGHE ĐỐI PHƯƠNG/THÀNH VIÊN NHÓM ĐÃ XEM TIN NHẮN ---
    socket.on("messagesRead", (data) => {
      const { selectedUser, messages } = get();
      const { chatId, readBy, isGroup, chatPartnerId } = data;

      if (isGroup && selectedUser?._id === chatId) {
        const updatedMessages = messages.map((msg) => {
          const alreadyRead = msg.readBy?.some(r => (r.user?._id || r.user) === readBy._id);
          if (!alreadyRead) {
            return {
              ...msg,
              readBy: [...(msg.readBy || []), { user: readBy, readAt: new Date() }]
            };
          }
          return msg;
        });
        set({ messages: updatedMessages });
      } 
      else if (!isGroup && selectedUser?._id === chatPartnerId) {
        const updatedMessages = messages.map((m) => ({ ...m, isRead: true }));
        set({ messages: updatedMessages });
      }
    });

    socket.on("messageDeleted", (messageId) => {
      set({ messages: get().messages.filter((m) => m._id !== messageId) });
    });

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, users, groups, messages, unreadCounts } = get();
      const authUser = useAuthStore.getState().authUser;
      const { isSoundEnabled } = useAuthStore.getState(); // Lấy trạng thái âm thanh từ AuthStore
      if (!authUser) return;

      const currentChatId = selectedUser?._id?.toString();
      const msgGroupId = newMessage.groupId?.toString();
      const msgSenderId = (newMessage.senderId._id || newMessage.senderId).toString();
      const msgReceiverId = newMessage.receiverId?.toString();

      const chatIdOfIncomingMsg = msgGroupId || msgSenderId;
      const isChatRelevant = msgGroupId
        ? msgGroupId === currentChatId
        : msgSenderId === currentChatId || (msgSenderId === authUser._id.toString() && msgReceiverId === currentChatId);

      // --- LOGIC THÔNG BÁO ---
      if (msgSenderId !== authUser._id.toString()) {
        
        // 1. XỬ LÝ ÂM THANH: Chỉ phát nếu isSoundEnabled là true
        if (isSoundEnabled) {
          const notificationSound = new Audio("/ping.mp3");
          notificationSound.volume = 0.5;
          notificationSound.play().catch(() => {});
        }

        // 2. XỬ LÝ THÔNG BÁO CHỮ TRÊN TAB (Giữ nguyên không đổi)
        if (document.hidden || chatIdOfIncomingMsg !== currentChatId) {
          const originalTitle = "MERN Chat";
          const senderName = newMessage.senderId.fullName || "Ai đó";

          if (flashTitleInterval) clearInterval(flashTitleInterval);
          let isFlash = false;
          flashTitleInterval = setInterval(() => {
            document.title = isFlash ? originalTitle : `🔔 Tin nhắn từ ${senderName}...`;
            isFlash = !isFlash;
          }, 1000);

          const cleanUp = () => {
            clearInterval(flashTitleInterval);
            flashTitleInterval = null;
            document.title = originalTitle;
            window.removeEventListener("focus", cleanUp);
          };
          window.addEventListener("focus", cleanUp);
        }
      }

      if (isChatRelevant && msgSenderId !== authUser._id.toString()) {
        const isExisted = messages.some((m) => m._id === newMessage._id);
        if (!isExisted) {
          set({ messages: [...messages, newMessage] });
        }
        get().markAsRead(chatIdOfIncomingMsg);
      }

      if (msgSenderId !== authUser._id.toString() && chatIdOfIncomingMsg !== currentChatId) {
        const newCounts = {
          ...unreadCounts,
          [chatIdOfIncomingMsg]: (unreadCounts[chatIdOfIncomingMsg] || 0) + 1,
        };
        set({ unreadCounts: newCounts });
        setStoredUnreadCounts(newCounts);
      }

      if (msgGroupId) {
        const updatedGroups = groups
          .map((g) => (g._id.toString() === msgGroupId ? { ...g, lastMessage: newMessage } : g))
          .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ groups: updatedGroups });
      } else {
        const partnerId = msgSenderId === authUser._id.toString() ? msgReceiverId : msgSenderId;
        const updatedUsers = users
          .map((u) => (u._id.toString() === partnerId ? { ...u, lastMessage: newMessage } : u))
          .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        set({ users: updatedUsers });
      }
    });
  },

  markAsRead: async (chatId) => {
    const { unreadCounts, selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    try {
      if (unreadCounts[chatId]) {
        const newCounts = { ...unreadCounts, [chatId]: 0 };
        set({ unreadCounts: newCounts });
        setStoredUnreadCounts(newCounts);
      }

      await axiosInstance.put(`/messages/read/${chatId}`);

      if (socket && authUser) {
        const isGroup = !!selectedUser?.members;
        socket.emit("markAsRead", {
          chatId: chatId,
          senderId: chatId,
          receiverId: authUser._id,
          isGroup: isGroup
        });
      }
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã xem:", error);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;
    const socket = useAuthStore.getState().socket;
    if (socket && selectedUser.members) socket.emit("joinGroup", selectedUser._id);
    get().subscribeToChatUpdates();
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
    socket.off("messagesRead");
    socket.off("messageDeleted");
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
      set({ groups: get().groups.filter((g) => g._id !== groupId), selectedUser: null });
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