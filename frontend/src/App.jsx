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
    unsubscribeFromMessages, 
    getUsers, 
    getGroups,
    getMessages, // Lấy hàm này để đồng bộ lại tin nhắn
    selectedUser 
  } = useChatStore();

  const { 
    isCalling, 
    callAccepted, 
    setIncomingCall, 
    handleCallAccepted, 
    answerCall, 
    leaveCall,
    peerConnection 
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
        setIncomingCall(data);
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
                  <p className="mt-1 text-sm text-base-content/70">{data.name} đang gọi cho bạn...</p>
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
        ), { duration: 30000 });
      });

      // 2. Nghe khi đối phương chấp nhận cuộc gọi
      socket.on("callAccepted", (signal) => {
        handleCallAccepted(signal);
      });

      // 3. Nghe khi ĐỐI PHƯƠNG cúp máy
      socket.on("endCall", () => {
        // Tắt Camera/Micro local
        leaveCall(); 
        toast.error("Cuộc gọi đã kết thúc");

        // QUAN TRỌNG: Cập nhật lại tin nhắn ngay lập tức
        // Nếu đang mở đúng cửa sổ chat với người vừa gọi, load lại messages
        if (selectedUser) {
          getMessages(selectedUser._id);
        }
      });

      // 4. Nghe trao đổi ICE Candidates
      socket.on("ice-candidate", async (candidate) => {
        if (peerConnection) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("Lỗi add ice candidate", e);
          }
        }
      });

      return () => {
        socket.off("incomingCall");
        socket.off("callAccepted");
        socket.off("endCall");
        socket.off("ice-candidate");
      };
    }
  }, [authUser, socket, getUsers, getGroups, peerConnection, selectedUser, getMessages]); // Thêm dependencies vào đây

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );

  return (
    <div data-theme={theme} className="min-h-screen">
      <Navbar />

      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
      </Routes>

      {(isCalling || callAccepted) && <VideoModal />}

      <Toaster position="top-center" />
    </div>
  );
};

export default App;