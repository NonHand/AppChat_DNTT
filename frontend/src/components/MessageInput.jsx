import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Mic, Square } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState(null);
  
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null); // Thêm ref để quản lý stream bền vững hơn

  const { sendMessage, selectedUser } = useChatStore();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- LOGIC XỬ LÝ VOICE (ĐÃ SỬA LỖI) ---
  const startRecording = async () => {
    try {
      // 1. Luôn clear preview cũ trước khi thu mới
      setAudioPreview(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Lưu stream vào ref để stop sau này
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          setAudioPreview(reader.result);
        };
        
        // 2. Quan trọng: Dừng tất cả các track ngay khi ngừng ghi
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Mic error:", error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview && !audioPreview) return;

    try {
      const messagePayload = {
        text: text.trim(),
        image: imagePreview,
        audio: audioPreview,
      };

      if (selectedUser?.members) {
        messagePayload.groupId = selectedUser._id;
      }

      await sendMessage(messagePayload);

      // 3. Clear toàn bộ trạng thái sau khi gửi thành công
      setText("");
      setImagePreview(null);
      setAudioPreview(null); // Đảm bảo reset audioPreview về null
      if (fileInputRef.current) fileInputRef.current.value = "";
      
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="p-4 w-full">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Preview Voice */}
      {audioPreview && !isRecording && (
        <div className="mb-3 flex items-center gap-2 bg-base-200 p-2 rounded-lg w-fit border border-primary/20">
          <Mic className="size-4 text-primary animate-pulse" />
          <span className="text-xs font-medium">Voice message ready</span>
          <button 
            type="button" 
            onClick={() => setAudioPreview(null)} 
            className="text-error hover:bg-error/10 rounded-full p-0.5"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder={selectedUser?.members ? `Message to ${selectedUser.name}...` : "Type a message..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isRecording}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle btn-sm sm:btn-md ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording}
          >
            <Image size={20} />
          </button>

          <button
            type="button"
            className={`btn btn-circle btn-sm sm:btn-md ${isRecording ? "btn-error animate-pulse text-white" : "text-zinc-400"}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? <Square size={18} /> : <Mic size={20} />}
          </button>
        </div>

        <button
          type="submit"
          className="btn btn-sm sm:btn-md btn-circle btn-primary"
          disabled={!text.trim() && !imagePreview && !audioPreview}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;