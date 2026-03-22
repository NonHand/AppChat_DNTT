import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { Trash2, Video, PhoneMissed, Mic, Phone } from "lucide-react"; 

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    deleteMessage,
  } = useChatStore();
  
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  const isGroup = !!selectedUser?.members;

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    if (typeof seconds === "string") return seconds; 
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isMyMessage = message.senderId === authUser._id || message.senderId?._id === authUser._id;
          const senderInfo = isMyMessage ? authUser : message.senderId;

          // LOGIC NHẬN DIỆN LOẠI TIN NHẮN
          const isVideoCall = message.callType === "video" || message.messageType === "video_call";
          const isVoice = message.messageType === "voice";
          
          // Kiểm tra cuộc gọi nhỡ (duration 00:00 hoặc status missed)
          const isMissed = message.duration === "00:00" || message.callDetails?.status === "missed";
          
          // Nhận diện log cuộc gọi (Từ Backend mới hoặc cấu trúc cũ)
          const isCallLog = !!message.callType || message.text?.includes("Cuộc gọi") || message.messageType === "call";

          return (
            <div
              key={message._id}
              className={`chat ${isMyMessage ? "chat-end" : "chat-start"}`}
            >
              <div className="chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={senderInfo?.profilePic || "/avatar.png"}
                    alt="profile pic"
                  />
                </div>
              </div>
              
              <div className="chat-header mb-1 flex flex-col">
                {isGroup && !isMyMessage && (
                  <span className="text-xs font-bold mb-1">{senderInfo?.fullName}</span>
                )}
                <time className="text-xs opacity-50 px-1">
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>

              <div className={`chat-bubble flex flex-col relative group max-w-[85%] 
                ${isCallLog ? "bg-base-200 text-base-content border border-base-300 shadow-sm" : ""}`}
              >
                {isMyMessage && (
                  <button
                    onClick={() => {
                      if (window.confirm("Bạn muốn xoá tin nhắn này?")) {
                        deleteMessage(message._id);
                      }
                    }}
                    className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                    text-base-content/50 hover:text-error transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                {/* 1. HIỂN THỊ TIN NHẮN CUỘC GỌI */}
                {isCallLog ? (
                  <div className="flex items-center gap-3 py-1 px-2 min-w-[160px]">
                    <div className={`p-2 rounded-full ${isMissed ? "bg-error/20 text-error" : "bg-primary/20 text-primary"}`}>
                      {isMissed ? (
                        <PhoneMissed size={20} />
                      ) : isVideoCall ? (
                        <Video size={20} />
                      ) : (
                        <Phone size={20} />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {isMissed ? "Cuộc gọi nhỡ" : isVideoCall ? "Cuộc gọi video" : "Cuộc gọi thoại"}
                      </span>
                      <span className="text-[11px] font-medium opacity-70">
                        {/* Ưu tiên hiển thị duration từ field riêng, nếu không có mới dùng text format sẵn */}
                        {message.duration ? `Thời lượng: ${message.duration}` : message.text}
                      </span>
                    </div>
                  </div>
                ) : isVoice ? (
                  /* 2. HIỂN THỊ TIN NHẮN GIỌNG NÓI */
                  <div className="flex flex-col gap-2 p-1">
                    <div className="flex items-center gap-2 text-primary-content/80">
                      <Mic size={14} />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Voice Message</span>
                    </div>
                    <audio 
                      src={message.audio} 
                      controls 
                      className="h-8 w-48 sm:w-60 filter invert brightness-200 contrast-75"
                    />
                    {message.text && <p className="text-sm mt-1">{message.text}</p>}
                  </div>
                ) : (
                  /* 3. HIỂN THỊ TIN NHẮN VĂN BẢN / HÌNH ẢNH */
                  <>
                    {message.image && (
                      <img
                        src={message.image}
                        alt="Attachment"
                        className="sm:max-w-[200px] rounded-md mb-2 object-cover"
                      />
                    )}
                    {message.text && <p className="text-sm leading-relaxed">{message.text}</p>}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messageEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;