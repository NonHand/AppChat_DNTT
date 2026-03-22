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

  // --- 1. LẮNG NGHE ICE CANDIDATE (Sửa lỗi đen hình) ---
  setupIceCandidateListener: () => {
    const { socket } = useAuthStore.getState();
    
    socket.off("ice-candidate"); // Tránh lặp listener

    socket.on("ice-candidate", async ({ candidate }) => {
      const { peerConnection } = get();
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ Đã kết nối ICE Candidate");
        } catch (error) {
          console.error("❌ Lỗi nạp ICE Candidate:", error);
        }
      }
    });
  },

  // --- 2. KHỞI TẠO CUỘC GỌI (Người gọi) ---
  initiateCall: async (selectedUser) => {
    const { socket, authUser } = useAuthStore.getState();
    get().setupIceCandidateListener();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      set({ isCalling: true, remoteUser: selectedUser, myStream: stream });

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { to: selectedUser._id, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        set({ userStream: event.streams[0] });
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("callUser", {
        userToCall: selectedUser._id,
        signalData: offer,
        from: authUser._id, 
        name: authUser.fullName 
      });

      set({ peerConnection: pc });
    } catch (err) {
      console.error("Lỗi Camera/Micro:", err);
      set({ isCalling: false });
    }
  },

  // --- 3. NHẬN CUỘC GỌI (Người nhận) ---
  answerCall: async () => {
    const { socket, authUser } = useAuthStore.getState();
    const { caller } = get();
    get().setupIceCandidateListener();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      set({ 
        callAccepted: true, 
        isReceivingCall: false, 
        myStream: stream,
        startTime: Date.now() 
      });

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { to: caller.from, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        set({ userStream: event.streams[0] });
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(caller.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answerCall", { signal: answer, to: caller.from });
      set({ peerConnection: pc });
    } catch (err) {
      console.error("Lỗi trả lời cuộc gọi:", err);
    }
  },

  // --- 4. KẾT THÚC CUỘC GỌI (Sửa lỗi mất tin nhắn log) ---
  leaveCall: () => {
    const { socket, authUser } = useAuthStore.getState();
    const { peerConnection, myStream, remoteUser, caller, startTime, callAccepted } = get();

    // Tính thời lượng (giây)
    const duration = (startTime && callAccepted) ? Math.floor((Date.now() - startTime) / 1000) : 0;

    // Ngắt camera/mic
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }

    // Đóng kết nối Peer
    if (peerConnection) {
      peerConnection.close();
    }

    // Xác định người nhận để gửi endCall và lưu Log
    const targetId = remoteUser?._id || caller?.from;

    if (targetId) {
      socket.emit("endCall", { 
        to: targetId, 
        duration: duration,
        senderId: authUser._id // QUAN TRỌNG: Backend cần cái này để lưu tin nhắn
      });
    }

    socket.off("ice-candidate");

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
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        set({ callAccepted: true, startTime: Date.now() });
      } catch (error) {
        console.error("❌ Lỗi setRemoteDescription:", error);
      }
    }
  }
}));