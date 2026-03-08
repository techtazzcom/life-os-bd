import { useState, useEffect, useRef, useCallback, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CallState {
  isInCall: boolean;
  isCalling: boolean;
  isReceiving: boolean;
  callType: "audio" | "video";
  remoteUser: { user_id: string; name: string } | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
}

interface CallContextType {
  callState: CallState;
  startCall: (userId: string, userName: string, type: "audio" | "video") => void;
  endCall: () => void;
  acceptCall: () => void;
  rejectCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const CallContext = createContext<CallContextType | null>(null);
export const useCall = () => useContext(CallContext)!;

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];



export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [callState, setCallState] = useState<CallState>({
    isInCall: false, isCalling: false, isReceiving: false,
    callType: "audio", remoteUser: null, isMuted: false, isVideoOff: false, callDuration: 0,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const currentUserIdRef = useRef("");
  const callSessionRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneRef = useRef<AudioContext | null>(null);
  const ringtoneOscRef = useRef<OscillatorNode[]>([]);
  const ringtoneTimerRef = useRef<number | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const callTypeRef = useRef<"audio" | "video">("audio");

  // Keep callType ref in sync
  useEffect(() => { callTypeRef.current = callState.callType; }, [callState.callType]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) currentUserIdRef.current = user.id;
    });
  }, []);

  // Callback refs to attach streams when elements mount
  const localVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    if (el && localStreamRef.current) {
      el.srcObject = localStreamRef.current;
      el.muted = true;
      el.playsInline = true;
      el.play().catch(() => {});
    }
  }, [callState.isInCall, callState.isCalling]); // re-run when call state changes

  const remoteVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    if (el && remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      el.playsInline = true;
      el.play().catch(() => {});
    }
  }, [callState.isInCall]); // re-run when in-call state changes

  const playRingtone = useCallback(() => {
    try {
      const ctx = new AudioContext();
      ringtoneRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.22;
      masterGain.connect(ctx.destination);

      // Add a subtle reverb-like effect
      const convolver = ctx.createConvolver();
      const reverbLen = ctx.sampleRate * 0.6;
      const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = reverbBuf.getChannelData(ch);
        for (let i = 0; i < reverbLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLen, 2.5);
        }
      }
      convolver.buffer = reverbBuf;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 0.7;
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.3;
      
      dryGain.connect(masterGain);
      convolver.connect(wetGain);
      wetGain.connect(masterGain);

      const playRingCycle = () => {
        if (!ringtoneRef.current || ringtoneRef.current.state === "closed") return;
        const now = ctx.currentTime;

        // iPhone-inspired melodic ringtone - warm & musical
        const notes = [
          // Opening phrase (ascending)
          { freq: 659.25, start: 0, dur: 0.12, type: "sine" as OscillatorType, vol: 0.35 },      // E5
          { freq: 783.99, start: 0.13, dur: 0.12, type: "sine" as OscillatorType, vol: 0.35 },    // G5
          { freq: 880.00, start: 0.26, dur: 0.18, type: "sine" as OscillatorType, vol: 0.4 },     // A5
          { freq: 1046.5, start: 0.46, dur: 0.22, type: "sine" as OscillatorType, vol: 0.35 },    // C6
          // Pause, then descending
          { freq: 880.00, start: 0.82, dur: 0.12, type: "sine" as OscillatorType, vol: 0.3 },     // A5
          { freq: 783.99, start: 0.95, dur: 0.12, type: "sine" as OscillatorType, vol: 0.3 },     // G5
          { freq: 659.25, start: 1.08, dur: 0.18, type: "sine" as OscillatorType, vol: 0.35 },    // E5
          // Ending flourish
          { freq: 783.99, start: 1.35, dur: 0.14, type: "sine" as OscillatorType, vol: 0.3 },     // G5
          { freq: 1046.5, start: 1.50, dur: 0.14, type: "sine" as OscillatorType, vol: 0.35 },    // C6
          { freq: 1174.7, start: 1.65, dur: 0.30, type: "sine" as OscillatorType, vol: 0.3 },     // D6 (resolve)
        ];

        notes.forEach(({ freq, start, dur, type, vol }) => {
          // Main tone
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, now + start);
          noteGain.gain.setValueAtTime(0, now + start);
          noteGain.gain.linearRampToValueAtTime(vol, now + start + 0.02);
          noteGain.gain.setValueAtTime(vol * 0.9, now + start + dur * 0.5);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + start + dur + 0.08);
          osc.connect(noteGain);
          noteGain.connect(dryGain);
          noteGain.connect(convolver);
          osc.start(now + start);
          osc.stop(now + start + dur + 0.1);
          ringtoneOscRef.current.push(osc);

          // Soft harmonic overtone (octave up, quieter)
          const osc2 = ctx.createOscillator();
          const noteGain2 = ctx.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(freq * 2, now + start);
          noteGain2.gain.setValueAtTime(0, now + start);
          noteGain2.gain.linearRampToValueAtTime(vol * 0.12, now + start + 0.03);
          noteGain2.gain.exponentialRampToValueAtTime(0.001, now + start + dur * 0.7);
          osc2.connect(noteGain2);
          noteGain2.connect(dryGain);
          osc2.start(now + start);
          osc2.stop(now + start + dur + 0.1);
          ringtoneOscRef.current.push(osc2);
        });

        // Repeat every 2.8 seconds
        ringtoneTimerRef.current = window.setTimeout(playRingCycle, 2800);
      };

      playRingCycle();
    } catch {}
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneTimerRef.current) { clearTimeout(ringtoneTimerRef.current); ringtoneTimerRef.current = null; }
    ringtoneOscRef.current.forEach(o => { try { o.stop(); } catch {} });
    ringtoneOscRef.current = [];
    if (ringtoneRef.current) { try { ringtoneRef.current.close(); } catch {} ringtoneRef.current = null; }
  }, []);

  const cleanup = useCallback(() => {
    stopRingtone();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    remoteStreamRef.current = null;
    pendingCandidatesRef.current = [];
    callSessionRef.current = "";
    setCallState({ isInCall: false, isCalling: false, isReceiving: false, callType: "audio", remoteUser: null, isMuted: false, isVideoOff: false, callDuration: 0 });
  }, [stopRingtone]);

  const createPeerConnection = useCallback((remoteUserId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (e) => {
      console.log("ontrack received:", e.track.kind);
      e.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      // Attach remote stream to audio element for reliable playback
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {});
      }
      // Force re-render to trigger callback refs
      setCallState(s => ({ ...s }));
    };

    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await supabase.from("call_signals").insert({
          caller_id: currentUserIdRef.current,
          receiver_id: remoteUserId,
          signal_type: "ice-candidate",
          signal_data: { candidate: e.candidate.toJSON() } as any,
          call_type: callTypeRef.current,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        cleanup();
      }
    };

    return pc;
  }, [cleanup]);

  const startCall = useCallback(async (userId: string, userName: string, type: "audio" | "video") => {
    const myId = currentUserIdRef.current;
    if (!myId) {
      console.error("No current user ID");
      return;
    }

    try {
      // Update call type first
      callTypeRef.current = type;

      // Request media with mobile-friendly constraints
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      const sessionId = crypto.randomUUID();
      callSessionRef.current = sessionId;

      setCallState(s => ({ ...s, isCalling: true, callType: type, remoteUser: { user_id: userId, name: userName } }));
      playRingtone();

      await supabase.from("call_signals").insert({
        caller_id: myId,
        receiver_id: userId,
        signal_type: "call-start",
        signal_data: { sessionId, callerName: "" } as any,
        call_type: type,
      });

      const pc = createPeerConnection(userId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === "video" });
      await pc.setLocalDescription(offer);

      await supabase.from("call_signals").insert({
        caller_id: myId,
        receiver_id: userId,
        signal_type: "offer",
        signal_data: { sdp: offer.sdp, type: offer.type, sessionId } as any,
        call_type: type,
      });
    } catch (err) {
      console.error("Call failed:", err);
      cleanup();
    }
  }, [createPeerConnection, playRingtone, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!callState.remoteUser) return;
    const myId = currentUserIdRef.current;
    const remoteId = callState.remoteUser.user_id;

    try {
      stopRingtone();

      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callState.callType === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      const pc = createPeerConnection(remoteId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const { data: offerData } = await supabase
        .from("call_signals")
        .select("*")
        .eq("caller_id", remoteId)
        .eq("receiver_id", myId)
        .eq("signal_type", "offer")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (offerData) {
        const signalData = offerData.signal_data as any;
        await pc.setRemoteDescription(new RTCSessionDescription({ sdp: signalData.sdp, type: signalData.type }));

        for (const candidate of pendingCandidatesRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        }
        pendingCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await supabase.from("call_signals").insert({
          caller_id: myId,
          receiver_id: remoteId,
          signal_type: "answer",
          signal_data: { sdp: answer.sdp, type: answer.type } as any,
          call_type: callState.callType,
        });
      }

      setCallState(s => ({ ...s, isInCall: true, isReceiving: false, isCalling: false, callDuration: 0 }));
      timerRef.current = setInterval(() => {
        setCallState(s => ({ ...s, callDuration: s.callDuration + 1 }));
      }, 1000);
    } catch (err) {
      console.error("Accept failed:", err);
      cleanup();
    }
  }, [callState.remoteUser, callState.callType, createPeerConnection, stopRingtone, cleanup]);

  const rejectCall = useCallback(async () => {
    if (!callState.remoteUser) return;
    stopRingtone();
    await supabase.from("call_signals").insert({
      caller_id: currentUserIdRef.current,
      receiver_id: callState.remoteUser.user_id,
      signal_type: "call-reject",
      signal_data: {} as any,
      call_type: callState.callType,
    });
    cleanup();
  }, [callState.remoteUser, callState.callType, stopRingtone, cleanup]);

  const endCall = useCallback(async () => {
    if (callState.remoteUser) {
      await supabase.from("call_signals").insert({
        caller_id: currentUserIdRef.current,
        receiver_id: callState.remoteUser.user_id,
        signal_type: "call-end",
        signal_data: {} as any,
        call_type: callState.callType,
      });
    }
    cleanup();
  }, [callState.remoteUser, callState.callType, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setCallState(s => ({ ...s, isMuted: !s.isMuted }));
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setCallState(s => ({ ...s, isVideoOff: !s.isVideoOff }));
    }
  }, []);

  // Listen for incoming signals
  useEffect(() => {
    const channel = supabase
      .channel("call-signals")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals" }, async (payload) => {
        const signal = payload.new as any;
        const myId = currentUserIdRef.current;
        if (!myId || signal.receiver_id !== myId) return;

        if (signal.signal_type === "call-start") {
          const { data: callerProfile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", signal.caller_id)
            .single();

          playRingtone();
          setCallState(s => ({
            ...s,
            isReceiving: true,
            callType: signal.call_type,
            remoteUser: { user_id: signal.caller_id, name: callerProfile?.name || "Unknown" },
          }));
        }

        if (signal.signal_type === "answer" && pcRef.current) {
          stopRingtone();
          const signalData = signal.signal_data as any;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription({ sdp: signalData.sdp, type: signalData.type }));

          for (const candidate of pendingCandidatesRef.current) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
          }
          pendingCandidatesRef.current = [];

          setCallState(s => ({ ...s, isInCall: true, isCalling: false, callDuration: 0 }));
          timerRef.current = setInterval(() => {
            setCallState(s => ({ ...s, callDuration: s.callDuration + 1 }));
          }, 1000);
        }

        if (signal.signal_type === "ice-candidate") {
          const candidateData = (signal.signal_data as any).candidate;
          if (pcRef.current && pcRef.current.remoteDescription) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidateData)); } catch {}
          } else {
            pendingCandidatesRef.current.push(candidateData);
          }
        }

        if (signal.signal_type === "call-end" || signal.signal_type === "call-reject") {
          cleanup();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [playRingtone, stopRingtone, cleanup]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const isActive = callState.isInCall || callState.isCalling || callState.isReceiving;

  return (
    <CallContext.Provider value={{ callState, startCall, endCall, acceptCall, rejectCall, toggleMute, toggleVideo }}>
      {children}

      {/* Incoming Call UI */}
      {callState.isReceiving && !callState.isInCall && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xl flex items-center justify-center">
          <div className="bg-card rounded-3xl p-8 shadow-2xl border border-border max-w-sm w-full mx-4 text-center animate-fade-in-up">
            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-4xl mb-4 animate-pulse">
              {callState.callType === "video" ? "📹" : "📞"}
            </div>
            <h2 className="text-xl font-black text-foreground mb-1">{callState.remoteUser?.name}</h2>
            <p className="text-muted-foreground text-sm font-bold mb-6">
              {callState.callType === "video" ? "ভিডিও কল আসছে..." : "অডিও কল আসছে..."}
            </p>
            <div className="flex justify-center gap-6">
              <button onClick={rejectCall} className="w-16 h-16 bg-destructive rounded-full flex items-center justify-center text-2xl shadow-lg hover:opacity-90 transition active:scale-95 animate-bounce">
                📵
              </button>
              <button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-2xl shadow-lg hover:opacity-90 transition active:scale-95 animate-bounce" style={{ animationDelay: "0.1s" }}>
                📞
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing Call UI */}
      {callState.isCalling && !callState.isInCall && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xl flex items-center justify-center">
          <div className="bg-card rounded-3xl p-8 shadow-2xl border border-border max-w-sm w-full mx-4 text-center animate-fade-in-up">
            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-4xl mb-4 animate-pulse">
              {callState.callType === "video" ? "📹" : "📞"}
            </div>
            <h2 className="text-xl font-black text-foreground mb-1">{callState.remoteUser?.name}</h2>
            <p className="text-muted-foreground text-sm font-bold mb-6">কল করা হচ্ছে...</p>
            <button onClick={endCall} className="w-16 h-16 mx-auto bg-destructive rounded-full flex items-center justify-center text-2xl shadow-lg hover:opacity-90 transition active:scale-95">
              📵
            </button>
          </div>
        </div>
      )}

      {/* In-Call UI */}
      {callState.isInCall && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          {callState.callType === "video" ? (
            <div className="flex-1 relative">
              <video
                ref={remoteVideoCallbackRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <video
                ref={localVideoCallbackRef}
                autoPlay
                playsInline
                muted
                className="absolute top-4 right-4 w-32 h-44 md:w-40 md:h-56 rounded-2xl object-cover border-2 border-primary shadow-xl"
              />
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 pt-6">
                <h2 className="text-white font-black text-lg text-center">{callState.remoteUser?.name}</h2>
                <p className="text-white/60 text-sm font-bold text-center">{formatDuration(callState.callDuration)}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-28 h-28 mx-auto bg-primary/20 rounded-full flex items-center justify-center text-5xl mb-4">
                  {callState.remoteUser?.name?.charAt(0)?.toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-white mb-2">{callState.remoteUser?.name}</h2>
                <p className="text-white/60 text-lg font-bold">{formatDuration(callState.callDuration)}</p>
              </div>
            </div>
          )}

          {/* Always-mounted hidden audio element for remote stream playback */}
          <audio
            ref={(el) => {
              remoteAudioRef.current = el;
              if (el && remoteStreamRef.current) {
                el.srcObject = remoteStreamRef.current;
                el.play().catch(() => {});
              }
            }}
            autoPlay
            playsInline
            className="hidden"
          />

          {/* Controls */}
          <div className="bg-black/90 p-6 pb-8">
            <div className="flex justify-center items-center gap-5">
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition active:scale-95 ${callState.isMuted ? 'bg-destructive/80 text-white' : 'bg-white/20 text-white'}`}
              >
                {callState.isMuted ? "🔇" : "🎤"}
              </button>
              {callState.callType === "video" && (
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition active:scale-95 ${callState.isVideoOff ? 'bg-destructive/80 text-white' : 'bg-white/20 text-white'}`}
                >
                  {callState.isVideoOff ? "🚫" : "📹"}
                </button>
              )}
              <button
                onClick={endCall}
                className="w-16 h-16 bg-destructive rounded-full flex items-center justify-center text-2xl shadow-lg hover:opacity-90 transition active:scale-95"
              >
                📵
              </button>
            </div>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
};
