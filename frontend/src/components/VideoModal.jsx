import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../store/useCallStore";
import { useChatStore } from "../store/useChatStore"; 
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

const VideoModal = () => {
  const { 
    myStream, 
    userStream, 
    leaveCall, 
    callAccepted, 
    isCalling, 
    remoteUser, 
    caller 
  } = useCallStore();

  const { saveCallLog } = useChatStore(); 

  const myVideo = useRef();
  const userVideo = useRef();
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  
  const [startTime, setStartTime] = useState(null);

  // 1. Ghi lại thời điểm bắt đầu khi cuộc gọi thực sự được CHẤP NHẬN
  useEffect(() => {
    if (callAccepted && !startTime) {
      setStartTime(Date.now());
    }
  }, [callAccepted, startTime]);

  // Hiển thị stream của mình
  useEffect(() => {
    if (myStream && myVideo.current) {
      myVideo.current.srcObject = myStream;
    }
  }, [myStream]);

  // Hiển thị stream của đối phương
  useEffect(() => {
    if (callAccepted && userStream && userVideo.current) {
      userVideo.current.srcObject = userStream;
    }
  }, [callAccepted, userStream]);

  // Format miliseconds sang định dạng mm:ss
  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * HÀM KẾT THÚC CUỘC GỌI
   * Cập nhật: Đảm bảo lưu log và thời lượng xong mới đóng Modal
   */
  const handleEndCall = async () => {
    const endTime = Date.now();
    // Tính thời gian: nếu cuộc gọi chưa được chấp nhận (missed), duration = 0
    const durationMs = (startTime && callAccepted) ? endTime - startTime : 0;
    const durationStr = formatDuration(durationMs);
    
    // Xác định ID người nhận tin nhắn log
    const targetId = isCalling ? remoteUser?._id : caller?.from;

    if (targetId) {
      try {
        // Gửi thông báo kết thúc kèm thời lượng gọi
        // await ở đây để đảm bảo Store kịp update trước khi component bị hủy (unmount)
        await saveCallLog(targetId, {
          duration: durationStr,
          callType: "video",
          // Bạn có thể thêm trạng thái nếu muốn (ví dụ: cuộc gọi nhỡ)
          text: durationMs > 0 ? "Cuộc gọi video" : "Cuộc gọi nhỡ"
        });
      } catch (error) {
        console.error("Lỗi gửi thông báo kết thúc cuộc gọi:", error);
      }
    }

    // Cuối cùng mới ngắt kết nối WebRTC và đóng giao diện gọi
    leaveCall();
  };

  const toggleMic = () => {
    if (myStream) {
      myStream.getAudioTracks()[0].enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCam = () => {
    if (myStream) {
      myStream.getVideoTracks()[0].enabled = !isCamOn;
      setIsCamOn(!isCamOn);
    }
  };

  const displayName = remoteUser?.fullName || caller?.name || "Người dùng";

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        
        {/* Màn hình đối phương */}
        <div className="w-full h-full flex items-center justify-center bg-slate-900">
          {callAccepted ? (
            <video
              playsInline
              ref={userVideo}
              autoPlay
              className="w-full h-full object-cover mirror"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="size-24 rounded-full bg-primary/20 animate-pulse flex items-center justify-center">
                <span className="text-4xl">📞</span>
              </div>
              <p className="text-white text-xl font-medium">
                {isCalling ? `Đang gọi cho ${displayName}...` : `Đang kết nối với ${displayName}...`}
              </p>
            </div>
          )}
        </div>

        {/* Màn hình của mình (PIP) */}
        <div className="absolute top-4 right-4 w-32 md:w-64 aspect-video bg-slate-800 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-10">
          <video
            playsInline
            muted
            ref={myVideo}
            autoPlay
            className="w-full h-full object-cover mirror"
          />
          <div className="absolute bottom-1 left-2 text-[10px] text-white bg-black/50 px-1 rounded">
            Bạn
          </div>
        </div>

        {/* Thanh công cụ */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
          <button
            onClick={toggleMic}
            className={`p-4 rounded-full transition-all ${isMicOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-error text-white"}`}
            title={isMicOn ? "Tắt Mic" : "Bật Mic"}
          >
            {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          <button
            onClick={handleEndCall}
            className="p-5 bg-error text-white rounded-full hover:scale-110 transition-transform shadow-lg shadow-error/50"
            title="Kết thúc cuộc gọi"
          >
            <PhoneOff size={28} />
          </button>

          <button
            onClick={toggleCam}
            className={`p-4 rounded-full transition-all ${isCamOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-error text-white"}`}
            title={isCamOn ? "Tắt Camera" : "Bật Camera"}
          >
            {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
        </div>
      </div>

      <p className="mt-6 text-slate-400 text-sm tracking-widest uppercase animate-pulse">
        WebRTC Secure Connection
      </p>
    </div>
  );
};

export default VideoModal;