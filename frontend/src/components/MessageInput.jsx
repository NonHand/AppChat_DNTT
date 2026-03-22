import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Mic, Square, Paperclip, FileText } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [filePreview, setFilePreview] = useState(null); // Trạng thái cho File
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState(null);
  
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null); // Ref cho input file
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  const { sendMessage, selectedUser } = useChatStore();

  // --- XỬ LÝ HÌNH ẢNH ---
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setFilePreview(null); // Tắt preview file nếu chọn ảnh
    };
    reader.readAsDataURL(file);
  };

  // --- XỬ LÝ FILE (PDF, DOCX, ZIP, v.v.) ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Giới hạn dung lượng file (VD: 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview({
        name: file.name,
        size: file.size,
        base64: reader.result,
      });
      setImagePreview(null); // Tắt preview ảnh nếu chọn file
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeFile = () => {
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- LOGIC XỬ LÝ VOICE ---
  const startRecording = async () => {
    try {
      setAudioPreview(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
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
    if (!text.trim() && !imagePreview && !audioPreview && !filePreview) return;

    try {
      const messagePayload = {
        text: text.trim(),
        image: imagePreview,
        audio: audioPreview,
        file: filePreview?.base64, // Gửi dữ liệu file
        fileName: filePreview?.name, // Gửi tên file
        fileSize: filePreview?.size,
      };

      if (selectedUser?.members) {
        messagePayload.groupId = selectedUser._id;
      }

      await sendMessage(messagePayload);

      // Reset trạng thái
      setText("");
      setImagePreview(null);
      setAudioPreview(null);
      setFilePreview(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
      
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="p-4 w-full">
      {/* Image Preview */}
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

      {/* File Preview */}
      {filePreview && (
        <div className="mb-3 flex items-center gap-2 bg-base-200 p-2 rounded-lg w-fit border border-primary/20">
          <FileText className="size-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-xs font-medium truncate max-w-[150px]">{filePreview.name}</span>
            <span className="text-[10px] opacity-50">{(filePreview.size / 1024).toFixed(1)} KB</span>
          </div>
          <button 
            type="button" 
            onClick={removeFile} 
            className="text-error hover:bg-error/10 rounded-full p-0.5 ml-1"
          >
            <X className="size-4" />
          </button>
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
          
          {/* Input Ẩn cho Ảnh */}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={imageInputRef}
            onChange={handleImageChange}
          />

          {/* Input Ẩn cho File */}
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {/* Nút Chọn Ảnh */}
          <button
            type="button"
            className={`hidden sm:flex btn btn-circle btn-sm sm:btn-md ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => imageInputRef.current?.click()}
            disabled={isRecording}
          >
            <Image size={20} />
          </button>

          {/* Nút Chọn File */}
          <button
            type="button"
            className={`hidden sm:flex btn btn-circle btn-sm sm:btn-md ${filePreview ? "text-primary" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording}
          >
            <Paperclip size={20} />
          </button>

          {/* Nút Voice */}
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
          disabled={!text.trim() && !imagePreview && !audioPreview && !filePreview}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;