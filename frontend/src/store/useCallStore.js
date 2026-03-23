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
    
    // Xóa listener cũ để tránh trùng lặp khi gọi nhiều lần
    socket.off("ice-candidate");

    socket.on("ice-candidate", async ({ candidate }) => {
      const { peerConnection } = get();
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ Đã nạp ICE Candidate từ đối phương thành công");
        } catch (error) {
          console.error("❌ Lỗi nạp ICE Candidate:", error);
        }
      }
    });
  },

  // --- 2. KHỞI TẠO CUỘC GỌI (Người gọi) ---
  initiateCall: async (selectedUser) => {
    const { socket, authUser } = useAuthStore.getState();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      set({ isCalling: true, remoteUser: selectedUser, myStream: stream });

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      });

      // Lắng nghe ứng viên mạng của chính mình để gửi đi
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { to: selectedUser._id, candidate: event.candidate });
        }
      };

      // Khi nhận được stream từ đối phương
      pc.ontrack = (event) => {
        console.log("🎬 Nhận được stream từ đối phương");
        set({ userStream: event.streams[0] });
      };

      // Add camera/mic của mình vào kết nối
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
      // Ghi chú: setupIceCandidateListener sẽ được gọi trong handleCallAccepted đối với người gọi
    } catch (err) {
      console.error("Lỗi Camera/Micro:", err);
      set({ isCalling: false });
    }
  },

  // --- 3. NHẬN CUỘC GỌI (Người nhận) ---
  answerCall: async () => {
    const { socket, authUser } = useAuthStore.getState();
    const { caller } = get();
    
    // Người nhận cần lắng nghe ICE ngay lập tức
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
        console.log("🎬 Nhận được stream từ đối phương (Người nhận)");
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

  // --- 4. KẾT THÚC CUỘC GỌI ---
  leaveCall: () => {
    const { socket, authUser } = useAuthStore.getState();
    const { peerConnection, myStream, remoteUser, caller, startTime, callAccepted } = get();

    const duration = (startTime && callAccepted) ? Math.floor((Date.now() - startTime) / 1000) : 0;

    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }

    if (peerConnection) {
      peerConnection.close();
    }

    const targetId = remoteUser?._id || caller?.from;

    if (targetId) {
      socket.emit("endCall", { 
        to: targetId, 
        duration: duration,
        senderId: authUser._id 
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
  
  // --- 5. XỬ LÝ KHI ĐỐI PHƯƠNG CHẤP NHẬN (Quan trọng để fix 2 chiều) ---
  handleCallAccepted: async (signal) => {
    const { peerConnection } = get();
    if (peerConnection) {
      try {
        // NGƯỜI GỌI: Phải bắt đầu lắng nghe ICE Candidate ngay khi người kia bắt máy
        get().setupIceCandidateListener(); 

        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        set({ callAccepted: true, startTime: Date.now() });
        console.log("✅ Đã thông suốt kết nối WebRTC 2 chiều");
      } catch (error) {
        console.error("❌ Lỗi setRemoteDescription:", error);
      }
    }
  }
}));