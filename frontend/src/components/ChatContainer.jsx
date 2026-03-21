import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { Trash2, Video, PhoneMissed, Mic } from "lucide-react"; // Thêm icon Mic

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

          const isVideoCall = message.messageType === "video_call";
          const isVoice = message.messageType === "voice"; // Kiểm tra tin nhắn thoại
          const isMissed = message.callDetails?.status === "missed";

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
                ${isVideoCall ? "bg-base-200 text-base-content border border-base-300 shadow-sm" : ""}`}
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

                {/* HIỂN THỊ NỘI DUNG CUỘC GỌI VIDEO */}
                {isVideoCall ? (
                  <div className="flex items-center gap-3 py-1 px-2">
                    <div className={`p-2 rounded-full ${isMissed ? "bg-error/20 text-error" : "bg-primary/20 text-primary"}`}>
                      {isMissed ? <PhoneMissed size={20} /> : <Video size={20} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {isMissed ? "Cuộc gọi nhỡ" : "Cuộc gọi video"}
                      </span>
                      {!isMissed && (
                        <span className="text-[11px] opacity-70">
                          Thời lượng: {formatDuration(message.callDetails?.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                ) : isVoice ? (
                  /* HIỂN THỊ TIN NHẮN GIỌNG NÓI (VOICE MESSAGE) */
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
                  /* HIỂN THỊ TIN NHẮN THÔNG THƯỜNG (TEXT/IMAGE) */
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