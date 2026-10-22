import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Mic, MicOff, Send, X, MessageSquare, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

interface ChatAndVoicePanelProps {
  username?: string;
  socket?: Socket | null;
  workspaceId?: string;
  onClose?: () => void;
}

export default function ChatAndVoicePanel({
  username = 'easha_16',
  socket,
  workspaceId,
  onClose,
}: ChatAndVoicePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(socket?.connected ?? false);

  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Track connection state and listen for incoming messages
  useEffect(() => {
    if (!socket) {
      setIsConnected(false);
      return;
    }

    setIsConnected(socket.connected);
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const handleIncomingMessage = (msg: Message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chatMessage', handleIncomingMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chatMessage', handleIncomingMessage);
    };
  }, [socket]);

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
      // event.results holds the whole session so far, so rebuild from index 0
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
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      baseTextRef.current = inputMessage ? inputMessage.trimEnd() + ' ' : '';
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

    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sender: username,
      text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    // Always show my own message immediately
    setMessages((prev) => [...prev, newMessage]);

    // Broadcast to everyone else in the workspace
    if (socket && isConnected) {
      socket.emit('chatMessage', { ...newMessage, workspaceId });
    }

    setInputMessage('');
    baseTextRef.current = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-300" />
          <h2 className="text-sm font-semibold text-white tracking-tight">Workspace Chat</h2>
          <span className="flex items-center gap-1.5 ml-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500">
            <Sparkles className="w-7 h-7 mb-2 text-gray-600" />
            <p className="text-xs font-medium text-gray-400">No messages yet.</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Start typing or use mic for voice-to-text.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === username;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium text-gray-400">{msg.sender}</span>
                  <span className="text-[10px] text-gray-600">{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-[90%] px-3 py-2 rounded-xl text-xs break-words ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-[#161b22] text-gray-200 border border-gray-800 rounded-bl-none'
                  }`}
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
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-800 bg-[#090d11]">
        <div className="relative flex items-center bg-[#161b22] border border-gray-800 rounded-xl px-2 py-1.5 focus-within:border-blue-500 transition-colors">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={isListening ? 'Listening...' : 'Type or speak...'}
            className="w-full bg-transparent text-xs text-white placeholder-gray-500 outline-none px-2"
          />

          <button
            type="button"
            onClick={toggleListening}
            className={`p-1.5 rounded-lg transition-colors mr-1 ${
              isListening
                ? 'bg-red-500/20 text-red-400 animate-pulse'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={isListening ? 'Stop mic' : 'Voice input'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}