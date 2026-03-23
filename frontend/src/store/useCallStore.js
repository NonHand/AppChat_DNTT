import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const initialState = {
  isCalling: false,
  isReceivingCall: false,
  callAccepted: false,
  caller: null,
  remoteUser: null,
  myStream: null,
  userStream: null,
  peerConnection: null,
  startTime: null,
};

export const useCallStore = create((set, get) => ({
  ...initialState,

  // --- 1. LẮNG NGHE ICE CANDIDATE ---
  setupIceCandidateListener: () => {
    const { socket } = useAuthStore.getState();
    socket.off("ice-candidate");

    socket.on("ice-candidate", async ({ candidate }) => {
      const { peerConnection } = get();
      if (peerConnection && candidate && peerConnection.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ ICE Candidate synchronized");
        } catch (error) {
          console.error("❌ ICE Error:", error);
        }
      }
    });
  },

  // --- 2. KHỞI TẠO CUỘC GỌI (Người gọi) ---
  initiateCall: async (selectedUser) => {
    // Chặn nếu đang bận
    if (get().isCalling || get().callAccepted) return;

    const { socket, authUser } = useAuthStore.getState();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      set({ isCalling: true, remoteUser: selectedUser, myStream: stream });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
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
      console.error("Camera error:", err);
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
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
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
      console.error("Answer error:", err);
    }
  },

  // --- 4. KẾT THÚC CUỘC GỌI (Fix triệt để lỗi Camera sáng) ---
  leaveCall: () => {
    const { socket, authUser } = useAuthStore.getState();
    const { peerConnection, myStream, remoteUser, caller, startTime, callAccepted } = get();

    // Dừng tất cả các track video/audio ngay lập tức
    if (myStream) {
      myStream.getTracks().forEach(track => {
        track.stop(); // Tắt phần cứng (đèn camera)
        track.enabled = false;
      });
    }

    if (peerConnection) {
      peerConnection.close(); // Đóng kết nối WebRTC
    }

    const duration = (startTime && callAccepted) ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const targetId = remoteUser?._id || caller?.from;

    if (targetId) {
      socket.emit("endCall", { 
        to: targetId, 
        duration: duration,
        senderId: authUser._id 
      });
    }

    socket.off("ice-candidate");

    // Reset store về trạng thái ban đầu sạch sẽ
    set(initialState);
  },

  // --- 5. LOGIC CHỐNG CUỘC GỌI CHỒNG (Busy State) ---
  setIncomingCall: (data) => {
    const { isCalling, callAccepted, isReceivingCall } = get();
    const { socket } = useAuthStore.getState();

    // Nếu đang có bất kỳ hoạt động gọi nào, gửi tín hiệu bận cho đối phương
    if (isCalling || callAccepted || isReceivingCall) {
      socket.emit("call-busy", { to: data.from });
      return;
    }

    set({ isReceivingCall: true, caller: data });
  },
  
  handleCallAccepted: async (signal) => {
    const { peerConnection } = get();
    if (peerConnection) {
      try {
        get().setupIceCandidateListener(); 
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        set({ callAccepted: true, startTime: Date.now() });
      } catch (error) {
        console.error("Accept error:", error);
      }
    }
  }
}));