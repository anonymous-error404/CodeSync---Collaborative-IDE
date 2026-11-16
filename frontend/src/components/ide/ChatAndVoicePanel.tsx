import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Mic, MicOff, Send, X, MessageSquare, Sparkles, Phone, PhoneOff, Headphones } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

interface VoiceState {
  joined: boolean;
  muted: boolean;
  callActive: boolean;
  teacherName?: string;
  startCall: () => void;
  endCall: () => void;
  joinCall: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
}

interface ChatAndVoicePanelProps {
  username?: string;
  socket?: Socket | null;
  workspaceId?: string;
  messages?: ChatMessage[];
  onSendMessage?: (text: string) => void;
  onClose?: () => void;
  voice?: VoiceState;
  isBroadcaster?: boolean;
}

export default function ChatAndVoicePanel({
  username = 'Anonymous',
  socket,
  workspaceId,
  messages: propMessages,
  onSendMessage,
  onClose,
  voice,
  isBroadcaster = false,
}: ChatAndVoicePanelProps) {
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messages = propMessages ?? localMessages;

  const [inputMessage, setInputMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(socket?.connected ?? false);

  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Track connection state and listen for incoming messages (if not handled by parent)
  useEffect(() => {
    if (!socket) {
      setIsConnected(false);
      return;
    }

    setIsConnected(socket.connected);
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const handleIncomingMessage = (msg: ChatMessage) => {
      setLocalMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (!propMessages) {
      socket.on('chatMessage', handleIncomingMessage);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      if (!propMessages) {
        socket.off('chatMessage', handleIncomingMessage);
      }
    };
  }, [socket, propMessages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech recognition setup
  useEffect(() => {
    const windowObj = window as any;
    const SpeechRecognition =
      windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputMessage(baseTextRef.current + transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      baseTextRef.current = inputMessage ? inputMessage + ' ' : '';
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        /* already started */
      }
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    if (onSendMessage) {
      onSendMessage(text);
    } else {
      const newMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender: username,
        text,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setLocalMessages((prev) => [...prev, newMessage]);

      if (socket) {
        socket.emit('chatMessage', { ...newMessage, workspaceId });
      }
    }

    setInputMessage('');
    baseTextRef.current = '';
  };

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ background: 'var(--surface)', color: 'var(--text)' }}
    >
      {/* Skeuomorphic Header Tab */}
      <div className="card-header-tab">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <span>COLLAB // CHAT_STREAM</span>
          <span className="flex items-center gap-1 ml-1.5 font-mono text-[10px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span style={{ color: 'var(--muted)' }}>{isConnected ? 'ONLINE' : 'CONNECTING'}</span>
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded cursor-pointer transition-colors text-[var(--muted)] hover:text-[var(--text)] bg-transparent border-none"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Voice Call Section (always at top) ── */}
      {voice && (
        <div
          className="shrink-0 px-3 py-2.5 border-b flex flex-col gap-2"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Phone size={12} className="text-emerald-500" />
              <span className="text-[11px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                Voice Call
              </span>
            </div>
            {voice.joined ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono"
                style={{ background: 'rgba(63,185,80,0.15)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            ) : voice.callActive ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>Standby</span>
            )}
          </div>

          <div className="flex gap-1.5">
            {isBroadcaster ? (
              voice.joined ? (
                <>
                  <button
                    onClick={voice.toggleMute}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-semibold btn-physical-surface cursor-pointer"
                    title={voice.muted ? 'Unmute' : 'Mute'}
                  >
                    {voice.muted ? <MicOff size={12} className="text-red-400" /> : <Mic size={12} />}
                    <span>{voice.muted ? 'Unmute' : 'Mute'}</span>
                  </button>
                  <button
                    onClick={voice.endCall}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer"
                    style={{ background: 'var(--error)', color: 'white', border: 'none' }}
                  >
                    <PhoneOff size={12} />
                    <span>End Call</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={voice.startCall}
                  className="w-full flex items-center justify-center gap-1.5 py-1 rounded-lg text-[11px] font-semibold btn-physical-primary cursor-pointer"
                  style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                >
                  <Phone size={12} />
                  <span>Start Voice Call</span>
                </button>
              )
            ) : voice.callActive ? (
              voice.joined ? (
                <button
                  onClick={voice.leaveCall}
                  className="w-full flex items-center justify-center gap-1.5 py-1 rounded-lg text-[11px] font-semibold btn-physical-surface cursor-pointer"
                  style={{ color: 'var(--error)' }}
                >
                  <PhoneOff size={12} />
                  <span>Leave Call</span>
                </button>
              ) : (
                <button
                  onClick={voice.joinCall}
                  className="w-full flex items-center justify-center gap-1.5 py-1 rounded-lg text-[11px] font-semibold btn-physical-primary animate-pulse cursor-pointer"
                  style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                  title={`${voice.teacherName || 'Broadcaster'} is speaking`}
                >
                  <Headphones size={12} />
                  <span>Join Call</span>
                </button>
              )
            ) : (
              <p className="text-[10px] w-full text-center py-0.5" style={{ color: 'var(--muted)' }}>
                No active voice session in this workspace.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ background: 'var(--bg)' }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <Sparkles className="w-7 h-7 mb-2 text-[var(--muted)] opacity-60" />
            <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>No messages yet.</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
              Type a message or press the microphone for voice-to-text.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === username;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                  <span className="font-semibold">{msg.sender}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-xs break-words shadow-xs ${
                    isMe
                      ? 'rounded-br-none text-white'
                      : 'rounded-bl-none border'
                  }`}
                  style={{
                    background: isMe ? 'var(--accent)' : 'var(--surface)',
                    borderColor: isMe ? 'transparent' : 'var(--border)',
                    color: isMe ? '#ffffff' : 'var(--text)',
                  }}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Input Field */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="relative flex items-center px-2 py-1.5 rounded-xl border input-well"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={isListening ? 'Listening via microphone…' : 'Type a message…'}
            className="w-full bg-transparent text-xs outline-none px-2 focus:outline-none"
            style={{ color: 'var(--text)' }}
          />

          <button
            type="button"
            onClick={toggleListening}
            className={`p-1.5 rounded-lg transition-colors mr-1 cursor-pointer border-none ${
              isListening
                ? 'bg-red-500/20 text-red-500 animate-pulse'
                : 'text-[var(--muted)] hover:text-[var(--text)] bg-transparent'
            }`}
            title={isListening ? 'Stop mic' : 'Voice input'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="p-1.5 btn-physical-primary rounded-lg cursor-pointer disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
