import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useVoiceCall(
  socket: Socket | null,
  workspaceId: string,
  isTeacher: boolean
) {
  const [callActive, setCallActive] = useState(false); // call is running in this workspace
  const [joined, setJoined] = useState(false);         // I'm in it (teacher: broadcasting, student: listening)
  const [muted, setMuted] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [error, setError] = useState('');

  const peers = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const localStream = useRef<MediaStream | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);

  const closePeer = useCallback((id: string) => {
    peers.current.get(id)?.close();
    peers.current.delete(id);
    pendingIce.current.delete(id);
  }, []);

  const cleanupAll = useCallback(() => {
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
    pendingIce.current.clear();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    if (audioEl.current) {
      audioEl.current.srcObject = null;
      audioEl.current = null;
    }
    setJoined(false);
    setMuted(false);
  }, []);

  const createPeer = useCallback(
    (peerId: string) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peers.current.set(peerId, pc);

      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit('voice-signal', {
            workspaceId, to: peerId, data: { candidate: e.candidate.toJSON() },
          });
        }
      };

      // Student side: play the teacher's audio
      pc.ontrack = (e) => {
        if (!audioEl.current) {
          audioEl.current = new Audio();
          audioEl.current.autoplay = true;
        }
        audioEl.current.srcObject = e.streams[0];
        audioEl.current.play().catch(() => {});
      };

      // Teacher side: send mic audio
      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));

      return pc;
    },
    [socket, workspaceId]
  );

  const flushIce = async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIce.current.get(peerId) ?? [];
    pendingIce.current.delete(peerId);
    for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
  };

  // ── Socket listeners ──
  useEffect(() => {
    if (!socket) return;

    const onStarted = ({ teacherName }: { teacherName: string }) => {
      setCallActive(true);
      setTeacherName(teacherName);
    };

    const onEnded = () => {
      setCallActive(false);
      setTeacherName('');
      cleanupAll();
    };

    // Teacher: a student wants to listen -> send offer
    const onPeerJoined = async ({ socketId }: { socketId: string }) => {
      if (!isTeacher || !localStream.current) return;
      closePeer(socketId);
      const pc = createPeer(socketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice-signal', {
        workspaceId, to: socketId, data: { sdp: pc.localDescription },
      });
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => closePeer(socketId);

    const onSignal = async ({ from, data }: { from: string; data: any }) => {
      try {
        if (data.sdp) {
          if (data.sdp.type === 'offer') {
            // Student receives offer from teacher
            closePeer(from);
            const pc = createPeer(from);
            await pc.setRemoteDescription(data.sdp);
            await flushIce(from, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice-signal', {
              workspaceId, to: from, data: { sdp: pc.localDescription },
            });
          } else if (data.sdp.type === 'answer') {
            // Teacher receives answer from student
            const pc = peers.current.get(from);
            if (pc) {
              await pc.setRemoteDescription(data.sdp);
              await flushIce(from, pc);
            }
          }
        } else if (data.candidate) {
          const pc = peers.current.get(from);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(data.candidate).catch(() => {});
          } else {
            const q = pendingIce.current.get(from) ?? [];
            q.push(data.candidate);
            pendingIce.current.set(from, q);
          }
        }
      } catch (err) {
        console.error('[voice] signal error', err);
      }
    };

    socket.on('voice-started', onStarted);
    socket.on('voice-ended', onEnded);
    socket.on('voice-peer-joined', onPeerJoined);
    socket.on('voice-peer-left', onPeerLeft);
    socket.on('voice-signal', onSignal);

    return () => {
      socket.off('voice-started', onStarted);
      socket.off('voice-ended', onEnded);
      socket.off('voice-peer-joined', onPeerJoined);
      socket.off('voice-peer-left', onPeerLeft);
      socket.off('voice-signal', onSignal);
    };
  }, [socket, workspaceId, isTeacher, createPeer, closePeer, cleanupAll]);

  // Cleanup when leaving the workspace
  useEffect(() => () => cleanupAll(), [cleanupAll]);

  // ── Actions ──
  const startCall = useCallback(async () => {
    if (!socket || !isTeacher) return;
    setError('');
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setError('Microphone permission denied');
      return;
    }
    socket.emit('voice-start', { workspaceId });
    setCallActive(true);
    setJoined(true);
  }, [socket, workspaceId, isTeacher]);

  const endCall = useCallback(() => {
    socket?.emit('voice-stop', { workspaceId });
    setCallActive(false);
    cleanupAll();
  }, [socket, workspaceId, cleanupAll]);

  const joinCall = useCallback(() => {
    if (!socket || isTeacher) return;
    setJoined(true);
    socket.emit('voice-join', { workspaceId });
  }, [socket, workspaceId, isTeacher]);

  const leaveCall = useCallback(() => {
    socket?.emit('voice-leave', { workspaceId });
    cleanupAll();
  }, [socket, workspaceId, cleanupAll]);

  const toggleMute = useCallback(() => {
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  return {
    callActive, joined, muted, teacherName, error,
    startCall, endCall, joinCall, leaveCall, toggleMute,
  };
}