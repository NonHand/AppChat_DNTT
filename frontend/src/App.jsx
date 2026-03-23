import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import VideoModal from "./components/VideoModal";

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useThemeStore } from "./store/useThemeStore";
import { useCallStore } from "./store/useCallStore";
import { useEffect } from "react";

import { Loader, Phone } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, socket } = useAuthStore();
  const { theme } = useThemeStore();
  const { 
    subscribeToChatUpdates, 
    getUsers, 
    getGroups,
    getMessages, 
    selectedUser 
  } = useChatStore();

  const { 
    isCalling, 
    callAccepted, 
    isReceivingCall,
    setIncomingCall, 
    handleCallAccepted, 
    answerCall, 
    leaveCall
  } = useCallStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authUser && socket) {
      getUsers();
      getGroups();
      subscribeToChatUpdates();

      // 1. Nghe khi có người gọi đến
      socket.on("incomingCall", (data) => {
        // Hàm setIncomingCall trong store đã có logic check bận (Busy)
        setIncomingCall(data);
        
        // Chỉ hiện Toast nếu store cho phép nhận cuộc gọi
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-base-100 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-primary`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Phone className="text-primary animate-bounce" />
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-base-content">Cuộc gọi video đến</p>
                  <p className="mt-1 text-sm text-base-content/70">{data.name} đang gọi...</p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-base-300">
              <button
                onClick={() => {
                  answerCall();
                  toast.dismiss(t.id);
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary hover:bg-base-200 focus:outline-none"
              >
                Trả lời
              </button>
              <button
                onClick={() => {
                  leaveCall();
                  toast.dismiss(t.id);
                }}
                className="w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-error hover:bg-base-200 focus:outline-none"
              >
                Từ chối
              </button>
            </div>
          </div>
        ), { id: "incoming-call", duration: 30000 });
      });

      // 2. Nghe khi đối phương chấp nhận cuộc gọi
      socket.on("callAccepted", (signal) => {
        handleCallAccepted(signal);
      });

      // 3. Nghe khi đối phương đang bận (Mới thêm)
      socket.on("user-busy", () => {
        toast.error("Người dùng đang trong cuộc gọi khác", { id: "busy-error" });
        leaveCall();
      });

      // 4. Nghe khi ĐỐI PHƯƠNG cúp máy
      socket.on("endCall", () => {
        leaveCall(); 
        toast.dismiss("incoming-call");
        toast("Cuộc gọi đã kết thúc", { icon: '📞' });

        // Cập nhật lại tin nhắn để hiện log cuộc gọi vừa kết thúc
        if (selectedUser) {
          getMessages(selectedUser._id);
        }
      });

      return () => {
        socket.off("incomingCall");
        socket.off("callAccepted");
        socket.off("user-busy");
        socket.off("endCall");
      };
    }
  }, [authUser, socket, getUsers, getGroups, selectedUser, getMessages, answerCall, leaveCall, handleCallAccepted, setIncomingCall, subscribeToChatUpdates]);

  // Tự động đóng toast nếu máy nhận tự tắt modal cuộc gọi
  useEffect(() => {
    if (!isReceivingCall) {
      toast.dismiss("incoming-call");
    }
  }, [isReceivingCall]);

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );

  return (
    <div data-theme={theme} className="min-h-screen transition-colors duration-200">
      <Navbar />

      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
      </Routes>

      {/* Hiển thị Modal khi có bất kỳ hoạt động gọi nào */}
      {(isCalling || callAccepted || isReceivingCall) && <VideoModal />}

      <Toaster position="top-center" />
    </div>
  );
};

export default App;