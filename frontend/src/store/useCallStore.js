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

  // --- HÀM THIẾT LẬP LẮNG NGHE ICE CANDIDATE (QUAN TRỌNG) ---
  setupIceCandidateListener: () => {
    const { socket } = useAuthStore.getState();
    
    // Xóa listener cũ để tránh trùng lặp
    socket.off("ice-candidate");

    socket.on("ice-candidate", async ({ candidate }) => {
      const { peerConnection } = get();
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ Đã nạp thành công ICE Candidate từ đối phương");
        } catch (error) {
          console.error("❌ Lỗi khi nạp ICE Candidate:", error);
        }
      }
    });
  },

  // --- HÀM KHỞI TẠO CUỘC GỌI (Người gọi) ---
  initiateCall: async (selectedUser) => {
    const { socket, authUser } = useAuthStore.getState();
    get().setupIceCandidateListener(); // Bắt đầu lắng nghe ICE ngay khi gọi
    
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
        from: authUser._id, // Dùng ID thay vì socket.id để Backend dễ xử lý
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
    const { socket, authUser } = useAuthStore.getState();
    const { caller } = get();
    get().setupIceCandidateListener(); // Bắt đầu lắng nghe ICE ngay khi nhận

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
          // Gửi về phía người gọi (caller.from)
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

    const targetId = remoteUser?._id || caller?.from;
    socket.emit("endCall", { to: targetId });
    socket.off("ice-candidate"); // Tắt lắng nghe khi kết thúc

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