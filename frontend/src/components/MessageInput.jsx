import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Mic, Square, Paperclip, FileText } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  // Chuyển sang mảng để lưu nhiều ảnh preview
  const [imagePreviews, setImagePreviews] = useState([]);
  const [filePreview, setFilePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState(null);
  
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  const { sendMessage, selectedUser } = useChatStore();

  // --- XỬ LÝ NHIỀU HÌNH ẢNH ---
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Giới hạn số lượng ảnh (VD: tối đa 5 ảnh)
    if (imagePreviews.length + files.length > 5) {
      toast.error("You can only upload up to 5 images at once");
      return;
    }

    files.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result]);
        setFilePreview(null); // Tắt preview file nếu chọn ảnh
      };
      reader.readAsDataURL(file);
    });
  };

  // --- XỬ LÝ FILE ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
      setImagePreviews([]); // Tắt preview ảnh nếu chọn file
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
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
      toast.error("Could not access microphone.");
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
    if (!text.trim() && imagePreviews.length === 0 && !audioPreview && !filePreview) return;

    try {
      const messagePayload = {
        text: text.trim(),
        // Gửi mảng images cho backend xử lý
        images: imagePreviews, 
        audio: audioPreview,
        file: filePreview?.base64,
        fileName: filePreview?.name,
        fileSize: filePreview?.size,
      };

      if (selectedUser?.members) {
        messagePayload.groupId = selectedUser._id;
      }

      await sendMessage(messagePayload);

      // Reset trạng thái
      setText("");
      setImagePreviews([]);
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
      {/* Multi-Image Preview */}
      {imagePreviews.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {imagePreviews.map((img, index) => (
            <div key={index} className="relative group">
              <img
                src={img}
                alt={`Preview ${index}`}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-zinc-700"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center hover:bg-error hover:text-white transition-colors"
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {/* Nút thêm ảnh nhanh nếu chưa đạt giới hạn */}
          {imagePreviews.length < 5 && (
            <button 
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:border-primary hover:text-primary transition-all"
            >
              <Image size={24} />
            </button>
          )}
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
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isRecording}
          />
          
          <input
            type="file"
            accept="image/*"
            multiple // Cho phép chọn nhiều ảnh
            className="hidden"
            ref={imageInputRef}
            onChange={handleImageChange}
          />

          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle btn-sm sm:btn-md ${imagePreviews.length > 0 ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => imageInputRef.current?.click()}
            disabled={isRecording}
          >
            <Image size={20} />
          </button>

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle btn-sm sm:btn-md ${filePreview ? "text-primary" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording}
          >
            <Paperclip size={20} />
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
          disabled={!text.trim() && imagePreviews.length === 0 && !audioPreview && !filePreview}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;