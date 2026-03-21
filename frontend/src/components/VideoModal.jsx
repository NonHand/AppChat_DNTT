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

  const myVideo = useRef();
  const userVideo = useRef();
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  // Hiển thị stream của mình khi có dữ liệu
  useEffect(() => {
    if (myStream && myVideo.current) {
      myVideo.current.srcObject = myStream;
    }
  }, [myStream]);

  // Hiển thị stream của đối phương khi cuộc gọi được chấp nhận
  useEffect(() => {
    if (callAccepted && userStream && userVideo.current) {
      userVideo.current.srcObject = userStream;
    }
  }, [callAccepted, userStream]);

  // Hàm bật/tắt Mic
  const toggleMic = () => {
    if (myStream) {
      myStream.getAudioTracks()[0].enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  // Hàm bật/tắt Camera
  const toggleCam = () => {
    if (myStream) {
      myStream.getVideoTracks()[0].enabled = !isCamOn;
      setIsCamOn(!isCamOn);
    }
  };

  const displayName = remoteUser?.fullName || caller?.name || "Người dùng";

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Container Video */}
      <div className="relative w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        
        {/* Video đối phương (Toàn màn hình Modal) */}
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

        {/* Video của mình (Cửa sổ nhỏ - Picture in Picture) */}
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

        {/* Thanh điều khiển (Controls) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
          {/* Nút Mic */}
          <button
            onClick={toggleMic}
            className={`p-4 rounded-full transition-all ${isMicOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-error text-white"}`}
          >
            {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          {/* Nút Cúp máy */}
          <button
            onClick={leaveCall}
            className="p-5 bg-error text-white rounded-full hover:scale-110 transition-transform shadow-lg shadow-error/50"
          >
            <PhoneOff size={28} />
          </button>

          {/* Nút Camera */}
          <button
            onClick={toggleCam}
            className={`p-4 rounded-full transition-all ${isCamOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-error text-white"}`}
          >
            {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
        </div>
      </div>

      {/* Thông tin người đang gọi phía dưới (Tùy chọn) */}
      <p className="mt-6 text-slate-400 text-sm tracking-widest uppercase">
        WebRTC Secure Connection
      </p>
    </div>
  );
};

export default VideoModal;