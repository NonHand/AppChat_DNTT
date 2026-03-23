import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../store/useCallStore";
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

  const myVideo = useRef(null);
  const userVideo = useRef(null);
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [startTimeState, setStartTimeState] = useState(null);

  // 1. Ghi lại thời điểm bắt đầu khi cuộc gọi thực sự được CHẤP NHẬN
  useEffect(() => {
    if (callAccepted && !startTimeState) {
      setStartTimeState(Date.now());
    }
  }, [callAccepted, startTimeState]);

  // 2. Hiển thị stream của mình (Gia cố thêm phần dọn dẹp srcObject)
  useEffect(() => {
    if (myStream && myVideo.current) {
      myVideo.current.srcObject = myStream;
    }
    return () => {
      if (myVideo.current) myVideo.current.srcObject = null;
    };
  }, [myStream]);

  // 3. Hiển thị stream của đối phương
  useEffect(() => {
    if (callAccepted && userStream && userVideo.current) {
      userVideo.current.srcObject = userStream;
    }
    return () => {
      if (userVideo.current) userVideo.current.srcObject = null;
    };
  }, [callAccepted, userStream]);

  /**
   * HÀM KẾT THÚC CUỘC GỌI
   * Cập nhật: Ưu tiên gọi leaveCall() để tắt camera/mic ngay lập tức, 
   * việc lưu log đã được handle bên trong store (socket.emit("endCall"))
   */
  const handleEndCall = () => {
    // Gọi leaveCall từ store. Hàm này sẽ:
    // 1. Dừng tất cả media tracks (Tắt đèn camera ngay lập tức)
    // 2. Emit sự kiện endCall lên server kèm theo duration
    // 3. Đóng PeerConnection và reset state
    leaveCall();
  };

  const toggleMic = () => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(!isMicOn);
      }
    }
  };

  const toggleCam = () => {
    if (myStream) {
      const videoTrack = myStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCamOn;
        setIsCamOn(!isCamOn);
      }
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
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="size-24 rounded-full bg-primary/20 animate-pulse flex items-center justify-center">
                <span className="text-4xl text-primary">📞</span>
              </div>
              <p className="text-white text-xl font-medium">
                {isCalling ? `Đang gọi cho ${displayName}...` : `Cuộc gọi đến từ ${displayName}...`}
              </p>
              <p className="text-slate-400 text-sm animate-bounce">Đang thiết lập kết nối bảo mật...</p>
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
            className={`p-4 rounded-full transition-all ${isMicOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500 text-white"}`}
            title={isMicOn ? "Tắt Mic" : "Bật Mic"}
          >
            {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          <button
            onClick={handleEndCall}
            className="p-5 bg-red-600 text-white rounded-full hover:scale-110 active:scale-95 transition-all shadow-lg shadow-red-500/50"
            title="Kết thúc cuộc gọi"
          >
            <PhoneOff size={28} />
          </button>

          <button
            onClick={toggleCam}
            className={`p-4 rounded-full transition-all ${isCamOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500 text-white"}`}
            title={isCamOn ? "Tắt Camera" : "Bật Camera"}
          >
            {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-slate-400 text-xs tracking-widest uppercase animate-pulse">
          WebRTC End-to-End Encrypted
        </p>
        {callAccepted && (
            <span className="text-primary text-sm font-mono bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                Live Connection Active
            </span>
        )}
      </div>
    </div>
  );
};

export default VideoModal;