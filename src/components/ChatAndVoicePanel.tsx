import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';

interface Props {
  socket: any;
  roomId: string;
  currentUser: string;
}

export default function ChatAndVoicePanel({ socket, roomId, currentUser }: Props) {
  const [messages, setMessages] = useState<Array<{ id: number; sender: string; message: string; time: string }>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    const joinRoom = () => {
      socket.emit('join-room', { roomId, userName: currentUser });
    };

    if (socket.connected) {
      joinRoom();
    }
    
    socket.on('connect', joinRoom);

    // Receive incoming messages
    socket.on('receive-message', (data: any) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.off('receive-message');
    };
  }, [socket, roomId, currentUser]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputMessage(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleSpeechToText = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    // Stop listening on message send
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    socket.emit('join-room', { roomId, userName: currentUser });
    socket.emit('send-message', { roomId, message: inputMessage, sender: currentUser });
    setInputMessage('');
  };

  return (
    <div className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col h-full text-slate-200 font-mono text-xs select-none">
      {/* Header Controls */}
      <div className="p-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wide text-slate-100">Live Workspace Chat</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] text-emerald-400 font-bold uppercase">Online</span>
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-[11px] font-mono text-center px-4">
            No messages yet. Use the input box or mic to start chatting.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold flex justify-between items-center mb-1">
                <span>{m.sender}</span>
                <span className="text-slate-600 font-normal">{m.time}</span>
              </div>
              <div className="text-slate-200 text-xs leading-relaxed break-words">{m.message}</div>
            </div>
          ))
        )}
      </div>

      {/* Speech-to-Text Input Area */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900/50 flex flex-col gap-2">
        {isListening && (
          <div className="flex items-center gap-2 px-1 text-[10px] text-cyan-400 font-bold animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
            Listening... Speak into your microphone
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'Type message or use mic...'}
              className="w-full pl-3 pr-10 py-2.5 bg-black border border-slate-800 focus:border-cyan-500 rounded-xl text-slate-200 text-xs outline-none transition-all shadow-inner"
            />
            
            {/* Pro-Level Icon-Based Mic Trigger */}
            <button
              type="button"
              onClick={toggleSpeechToText}
              title={isListening ? 'Stop Speech Recognition' : 'Start Speech Recognition'}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all cursor-pointer ${
                isListening
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="p-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}