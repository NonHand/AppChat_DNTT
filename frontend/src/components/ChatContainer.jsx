import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { Trash2, Video, PhoneMissed, Mic, Phone, FileText, Download, CheckCheck } from "lucide-react"; 

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    deleteMessage,
    markAsRead, // Lấy thêm hàm markAsRead từ store
  } = useChatStore();
  
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  // Cuộn xuống khi có tin nhắn mới
  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    
    // Logic: Nếu tin nhắn cuối cùng là của đối phương gửi cho mình, tự động markAsRead
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isIncoming = lastMessage.senderId === selectedUser._id || lastMessage.senderId?._id === selectedUser._id;
      
      if (isIncoming && !lastMessage.isRead) {
        markAsRead(selectedUser._id);
      }
    }
  }, [messages, selectedUser._id, markAsRead]);

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

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => {
          const isMyMessage = message.senderId === authUser._id || message.senderId?._id === authUser._id;
          
          const displayAvatar = isMyMessage 
            ? authUser.profilePic 
            : (isGroup ? message.senderId?.profilePic : selectedUser.profilePic);

          const displayName = isMyMessage 
            ? authUser.fullName 
            : (isGroup ? message.senderId?.fullName : selectedUser.fullName);

          const isVideoCall = message.callType === "video" || message.messageType === "video_call";
          const isVoice = message.messageType === "voice";
          const isFile = message.messageType === "file" || !!message.fileUrl;
          const isMissed = message.duration === "00:00" || message.callDetails?.status === "missed";
          const isCallLog = !!message.callType || message.text?.includes("Cuộc gọi") || message.messageType === "call" || message.messageType === "video_call";

          const hasMultipleImages = message.images && message.images.length > 0;
          const displayImages = hasMultipleImages ? message.images : (message.image ? [message.image] : []);

          // Kiểm tra xem đây có phải tin nhắn cuối cùng của mình không để hiện "Đã xem"
          const isLastMessage = index === messages.length - 1;

          return (
            <div
              key={message._id}
              className={`chat ${isMyMessage ? "chat-end" : "chat-start"}`}
            >
              <div className="chat-image avatar">
                <div className="size-10 rounded-full border overflow-hidden">
                  <img
                    src={displayAvatar || "/avatar.png"}
                    alt="profile pic"
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
              
              <div className="chat-header mb-1 flex flex-col">
                {isGroup && !isMyMessage && (
                  <span className="text-xs font-bold mb-1">{displayName}</span>
                )}
                <time className="text-[10px] opacity-50 px-1">
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>

              <div className={`chat-bubble flex flex-col relative group max-w-[85%] 
                ${isCallLog ? "bg-base-200 text-base-content border border-base-300 shadow-sm" : ""}
                ${isFile ? "bg-base-200 text-base-content border border-base-300" : ""}`}
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

                {isCallLog ? (
                  <div className="flex items-center gap-3 py-1 px-2 min-w-[160px]">
                    <div className={`p-2 rounded-full ${isMissed ? "bg-error/20 text-error" : "bg-primary/20 text-primary"}`}>
                      {isMissed ? <PhoneMissed size={20} /> : isVideoCall ? <Video size={20} /> : <Phone size={20} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {isMissed ? "Cuộc gọi nhỡ" : isVideoCall ? "Cuộc gọi video" : "Cuộc gọi thoại"}
                      </span>
                      <span className="text-[11px] font-medium opacity-70">
                        {message.duration ? `Thời lượng: ${message.duration}` : message.text}
                      </span>
                    </div>
                  </div>
                ) : isFile ? (
                  <div className="flex flex-col gap-2 p-1">
                    <div className="flex items-center gap-3 bg-base-300/50 p-3 rounded-lg border border-base-content/5 hover:bg-base-300 transition-colors">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <FileText size={24} />
                      </div>
                      <div className="flex flex-col overflow-hidden flex-1">
                        <span className="text-sm font-bold truncate max-w-[120px] sm:max-w-[200px]">
                          {message.fileName || "Tài liệu tập tin"}
                        </span>
                        <span className="text-[10px] opacity-60">
                          {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)} KB` : "Document"}
                        </span>
                      </div>
                      <a 
                        href={message.fileUrl} 
                        download={message.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 hover:bg-primary/20 text-primary rounded-full transition-all"
                      >
                        <Download size={18} />
                      </a>
                    </div>
                    {message.text && <p className="text-sm px-1">{message.text}</p>}
                  </div>
                ) : isVoice ? (
                  <div className="flex flex-col gap-2 p-1">
                    <div className="flex items-center gap-2 text-primary-content/80">
                      <Mic size={14} />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Voice Message</span>
                    </div>
                    <audio src={message.audio} controls className="h-8 w-48 sm:w-60 filter invert brightness-200 contrast-75" />
                    {message.text && <p className="text-sm mt-1">{message.text}</p>}
                  </div>
                ) : (
                  <>
                    {displayImages.length > 0 && (
                      <div className={`grid gap-1 mb-2 ${
                        displayImages.length === 1 ? "grid-cols-1" : "grid-cols-2"
                      }`}>
                        {displayImages.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt="Attachment"
                            className={`rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity
                              ${displayImages.length === 1 ? "max-h-60 w-auto" : "h-32 w-full"}
                              ${displayImages.length === 3 && idx === 0 ? "col-span-2 h-40" : ""} 
                            `}
                            onClick={() => window.open(img, "_blank")}
                          />
                        ))}
                      </div>
                    )}
                    {message.text && <p className="text-sm leading-relaxed">{message.text}</p>}
                  </>
                )}
              </div>

              {/* FOOTER TIN NHẮN: HIỂN THỊ TRẠNG THÁI ĐÃ XEM */}
              <div className="chat-footer opacity-70 flex items-center gap-1 mt-1">
                {isMyMessage && isLastMessage && (
                  <span className="text-[10px] flex items-center gap-1">
                    {message.isRead ? (
                      <>
                        <CheckCheck size={12} className="text-blue-500" />
                        <span className="text-blue-500 font-medium">Đã xem</span>
                      </>
                    ) : (
                      "Đã gửi"
                    )}
                  </span>
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