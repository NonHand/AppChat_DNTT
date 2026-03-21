import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

export const useCallStore = create((set, get) => ({
  // Trạng thái UI
  isCalling: false,           
  isReceivingCall: false,    
  callAccepted: false,       
  callEnded: false,          

  // Thông tin đối phương
  caller: null,              
  remoteUser: null,          

  // Media Streams
  myStream: null,            
  userStream: null,          

  // WebRTC Connection & Timing
  peerConnection: null,
  startTime: null,           

  // --- HÀM KHỞI TẠO CUỘC GỌI (Người gọi) ---
  initiateCall: async (selectedUser) => {
    const { socket, authUser } = useAuthStore.getState();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      set({ isCalling: true, remoteUser: selectedUser, myStream: stream });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      // Gửi các ứng viên mạng (ICE) cho đối phương
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { to: selectedUser._id, candidate: event.candidate });
        }
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        set({ userStream: event.streams[0] });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("callUser", {
        userToCall: selectedUser._id,
        signalData: offer,
        from: socket.id, // socketId hiện tại
        name: authUser.fullName 
      });

      set({ peerConnection: pc });
    } catch (err) {
      console.error("Không thể truy cập Camera/Micro:", err);
      set({ isCalling: false });
    }
  },

  // --- HÀM NHẬN CUỘC GỌI (Người nhận) ---
  answerCall: async () => {
    const { socket } = useAuthStore.getState();
    const { caller } = get();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      set({ 
        callAccepted: true, 
        isReceivingCall: false, 
        myStream: stream,
        startTime: Date.now() 
      });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { to: caller.from, candidate: event.candidate });
        }
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        set({ userStream: event.streams[0] });
      };

      await pc.setRemoteDescription(new RTCSessionDescription(caller.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answerCall", { signal: answer, to: caller.from });
      set({ peerConnection: pc });
    } catch (err) {
      console.error("Lỗi khi trả lời cuộc gọi:", err);
    }
  },

  // --- HÀM KẾT THÚC CUỘC GỌI ---
  leaveCall: () => {
    const { socket, authUser } = useAuthStore.getState();
    const { peerConnection, myStream, remoteUser, caller, startTime } = get();

    const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }

    if (peerConnection) {
      peerConnection.close();
    }

    // Xác định ID người nhận để Backend lưu Database chính xác
    // Nếu mình là người gọi: lấy remoteUser._id. Nếu mình là người nhận: lấy caller.userId
    const targetId = remoteUser?._id || caller?.userId || caller?.from;

    socket.emit("endCall", { 
      to: targetId, 
      duration: duration,
      senderId: authUser._id 
    });

    set({
      isCalling: false,
      isReceivingCall: false,
      callAccepted: false,
      myStream: null,
      userStream: null,
      peerConnection: null,
      caller: null,
      remoteUser: null,
      startTime: null
    });
  },

  setIncomingCall: (data) => set({ isReceivingCall: true, caller: data }),
  
  handleCallAccepted: async (signal) => {
    const { peerConnection } = get();
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
      set({ callAccepted: true, startTime: Date.now() });
    }
  }
}));