"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ICE_SERVERS, SPEAKING_THRESHOLD } from "../../watch-config";
import type { RtcSignal } from "./use-room-channel";

/**
 * 🎙️ Live mic — a plain one-to-one WebRTC call between the two of you,
 * signalled over the room's Realtime channel.
 *
 * Nothing is recorded and nothing is stored: the audio goes straight from one
 * browser to the other. There is no relay (TURN) server behind this, only
 * public STUN, so an unusually hostile network can stop the call from
 * connecting — when that happens the room says so plainly instead of leaving a
 * dead microphone icon lit.
 *
 * The mic is OFF when you walk in. Joining voice is always a deliberate tap.
 */

export type VoiceStatus = "off" | "connecting" | "live" | "failed";

export function useVoice({
  isHost,
  partnerInVoice,
  send,
  onSpeakingChange,
}: {
  /** The host is always the one who makes the offer — a fixed, boring rule. */
  isHost: boolean;
  /** From presence: is the other person on the call already? */
  partnerInVoice: boolean;
  send: (to: string | null, signal: RtcSignal) => void;
  onSpeakingChange: (speaking: boolean) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>("off");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  // The callbacks and the partner's state live in refs so the peer connection
  // isn't rebuilt every render; kept current in an effect, never during render.
  const sendRef = useRef(send);
  const speakCbRef = useRef(onSpeakingChange);
  const partnerInVoiceRef = useRef(partnerInVoice);
  useEffect(() => {
    sendRef.current = send;
    speakCbRef.current = onSpeakingChange;
    partnerInVoiceRef.current = partnerInVoice;
  }, [onSpeakingChange, partnerInVoice, send]);

  // ---- plumbing ------------------------------------------------------------

  const ensurePeer = useCallback((): RTCPeerConnection => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) sendRef.current(null, { kind: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0] ?? null);
      setStatus("live");
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("live");
      if (pc.connectionState === "failed") {
        setStatus("failed");
        setError("Suaranya nggak nyambung di jaringan ini. Chat masih jalan kok. ♡");
      }
    };
    pcRef.current = pc;
    return pc;
  }, []);

  /** The soft glowing ring: is this person talking right now? */
  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      let quietFrames = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        const loud = rms > SPEAKING_THRESHOLD && !localRef.current?.getAudioTracks()[0]?.muted;

        // Rise instantly, fall slowly — otherwise the ring strobes on every
        // gap between words.
        if (loud) {
          quietFrames = 0;
          if (!speakingRef.current) {
            speakingRef.current = true;
            speakCbRef.current(true);
          }
        } else if (speakingRef.current) {
          quietFrames += 1;
          if (quietFrames > 18) {
            speakingRef.current = false;
            speakCbRef.current(false);
          }
        }
        meterRef.current = requestAnimationFrame(tick);
      };
      meterRef.current = requestAnimationFrame(tick);
    } catch {
      // No meter is fine — the call still works, the ring just stays quiet.
    }
  }, []);

  const attachLocal = useCallback(async (): Promise<MediaStream> => {
    if (localRef.current) return localRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    localRef.current = stream;
    const pc = ensurePeer();
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    startMeter(stream);
    return stream;
  }, [ensurePeer, startMeter]);

  const makeOffer = useCallback(async () => {
    try {
      const pc = ensurePeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendRef.current(null, { kind: "offer", sdp: offer });
    } catch {
      setStatus("failed");
      setError("Gagal memulai panggilan suara.");
    }
  }, [ensurePeer]);

  const teardown = useCallback(
    (announce: boolean) => {
      if (announce) sendRef.current(null, { kind: "leave" });
      if (meterRef.current !== null) cancelAnimationFrame(meterRef.current);
      meterRef.current = null;
      void audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      for (const t of localRef.current?.getTracks() ?? []) t.stop();
      localRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      pendingIce.current = [];
      setRemoteStream(null);
      setMuted(false);
      setStatus("off");
      if (speakingRef.current) {
        speakingRef.current = false;
        speakCbRef.current(false);
      }
    },
    [],
  );

  // ---- what the room calls -------------------------------------------------

  const join = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      await attachLocal();
    } catch {
      setStatus("off");
      setError("Mic-nya nggak bisa dipakai. Cek izin mikrofon di browser ya.");
      return;
    }
    sendRef.current(null, { kind: "join" });
    // The host always offers; if the other side is already waiting on the call,
    // there's nothing to wait for.
    if (isHost && partnerInVoiceRef.current) await makeOffer();
  }, [attachLocal, isHost, makeOffer]);

  const leave = useCallback(() => teardown(true), [teardown]);

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
    if (!track.enabled && speakingRef.current) {
      speakingRef.current = false;
      speakCbRef.current(false);
    }
  }, []);

  /** Candidates that arrived before the description they belong to. */
  const drainIce = useCallback(async (pc: RTCPeerConnection) => {
    const queued = pendingIce.current;
    pendingIce.current = [];
    for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
  }, []);

  /** Signals arriving from the other side, in order. */
  const handleSignal = useCallback(
    async (signal: RtcSignal) => {
      // Their mic is on but ours isn't — nothing to negotiate yet.
      if (signal.kind === "join") {
        if (localRef.current && isHost) await makeOffer();
        return;
      }
      if (signal.kind === "leave") {
        if (localRef.current) {
          // Keep our own mic open; just drop the dead connection.
          pcRef.current?.close();
          pcRef.current = null;
          pendingIce.current = [];
          setRemoteStream(null);
          setStatus("connecting");
          const pc = ensurePeer();
          for (const track of localRef.current.getTracks()) pc.addTrack(track, localRef.current);
        }
        return;
      }
      if (!localRef.current) return; // we're not on the call

      try {
        const pc = ensurePeer();
        if (signal.kind === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await drainIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendRef.current(null, { kind: "answer", sdp: answer });
        } else if (signal.kind === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await drainIce(pc);
          }
        } else if (signal.kind === "ice") {
          if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate).catch(() => {});
          else pendingIce.current.push(signal.candidate);
        }
      } catch {
        setStatus("failed");
        setError("Panggilan suaranya gagal tersambung.");
      }
    },
    [drainIce, ensurePeer, isHost, makeOffer],
  );

  useEffect(() => () => teardown(false), [teardown]);

  return {
    status,
    inVoice: status !== "off",
    muted,
    error,
    remoteStream,
    join,
    leave,
    toggleMute,
    handleSignal,
  };
}
