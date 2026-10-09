import React, { useState } from 'react';
import ChatAndVoicePanel from './components/ChatAndVoicePanel';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Theme Presets Definition
type ThemeKey = 'cyber' | 'monokai' | 'dracula' | 'matrix';

interface ThemeConfig {
  name: string;
  bgGradient: string;
  accent: string;
  accentGlow: string;
  cardBg: string;
  border: string;
  hoverBorder: string;
  textAccent: string;
  buttonGradient: string;
  footerGradient: string;
  glowOrb1: string;
  glowOrb2: string;
  terminalText: string;
  codeSnippetBg: string;
}

const THEMES: Record<ThemeKey, ThemeConfig> = {
  cyber: {
    name: 'Cyber Cyan',
    bgGradient: 'from-cyan-950/40 via-indigo-950/30 to-slate-950',
    accent: 'cyan-400',
    accentGlow: 'rgba(6,182,212,0.4)',
    cardBg: 'bg-slate-900/70',
    border: 'border-cyan-500/30',
    hoverBorder: 'hover:border-cyan-400/80 hover:shadow-[0_0_25px_rgba(6,182,212,0.25)]',
    textAccent: 'text-cyan-400',
    buttonGradient: 'from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]',
    footerGradient: 'from-cyan-600 via-blue-600 to-indigo-600',
    glowOrb1: 'bg-cyan-500/20',
    glowOrb2: 'bg-indigo-600/25',
    terminalText: 'text-emerald-400',
    codeSnippetBg: 'rgba(6,182,212,0.06)',
  },
  monokai: {
    name: 'Monokai Dark',
    bgGradient: 'from-amber-950/40 via-stone-950/40 to-black',
    accent: 'amber-400',
    accentGlow: 'rgba(251,191,36,0.4)',
    cardBg: 'bg-stone-900/70',
    border: 'border-amber-500/30',
    hoverBorder: 'hover:border-amber-400/80 hover:shadow-[0_0_25px_rgba(251,191,36,0.25)]',
    textAccent: 'text-amber-400',
    buttonGradient: 'from-amber-500 via-orange-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 hover:shadow-[0_0_20px_rgba(251,191,36,0.5)]',
    footerGradient: 'from-amber-600 via-orange-600 to-yellow-600',
    glowOrb1: 'bg-amber-500/20',
    glowOrb2: 'bg-orange-600/20',
    terminalText: 'text-amber-300',
    codeSnippetBg: 'rgba(251,191,36,0.06)',
  },
  dracula: {
    name: 'Dracula Night',
    bgGradient: 'from-purple-950/40 via-slate-950/40 to-black',
    accent: 'purple-400',
    accentGlow: 'rgba(192,132,252,0.4)',
    cardBg: 'bg-slate-950/70',
    border: 'border-purple-500/30',
    hoverBorder: 'hover:border-purple-400/80 hover:shadow-[0_0_25px_rgba(192,132,252,0.25)]',
    textAccent: 'text-purple-400',
    buttonGradient: 'from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 hover:shadow-[0_0_20px_rgba(192,132,252,0.5)]',
    footerGradient: 'from-purple-600 via-indigo-600 to-violet-700',
    glowOrb1: 'bg-purple-600/20',
    glowOrb2: 'bg-indigo-600/25',
    terminalText: 'text-purple-300',
    codeSnippetBg: 'rgba(192,132,252,0.06)',
  },
  matrix: {
    name: 'Matrix Terminal',
    bgGradient: 'from-emerald-950/40 via-zinc-950/40 to-black',
    accent: 'emerald-400',
    accentGlow: 'rgba(52,211,153,0.4)',
    cardBg: 'bg-zinc-950/80',
    border: 'border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-400/80 hover:shadow-[0_0_25px_rgba(52,211,153,0.25)]',
    textAccent: 'text-emerald-400',
    buttonGradient: 'from-emerald-500 via-teal-600 to-green-700 hover:from-emerald-400 hover:to-green-600 hover:shadow-[0_0_20px_rgba(52,211,153,0.5)]',
    footerGradient: 'from-emerald-600 via-teal-600 to-green-700',
    glowOrb1: 'bg-emerald-500/20',
    glowOrb2: 'bg-teal-600/20',
    terminalText: 'text-emerald-300',
    codeSnippetBg: 'rgba(52,211,153,0.06)',
  },
};

// Icons Toolkit
const Icons = {
  Code: () => (
    <svg className="w-5 h-5 drop-shadow-[0_0_8px_currentColor]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  Terminal: () => (
    <svg className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Palette: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343a2 2 0 01-1.414-.586l-1.586-1.586A2 2 0 0010.243 12H7" />
    </svg>
  ),
  Play: () => (
    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Folder: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  FileCode: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  LogOut: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Cube3D: () => (
    <svg className="w-5 h-5 drop-shadow-[0_0_10px_currentColor]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  Close: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  GitBranch: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  Cpu: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  )
};

interface FileItem {
  id: string;
  name: string;
  content: string;
}

interface Workspace {
  id: string;
  name: string;
  language: string;
  files: FileItem[];
}

export function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  
  // Theme State
  const [currentThemeKey, setCurrentThemeKey] = useState<ThemeKey>('cyber');
  const theme = THEMES[currentThemeKey];

  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: 'ws_1',
      name: 'Distributed Mutual Exclusion Engine',
      language: 'Python',
      files: [
        { id: 'f1', name: 'token_manager.py', content: '# Suzuki-Kasami Broadcast Token Pass Algorithm\nimport time\n\nclass DistributedNode:\n    def __init__(self, node_id):\n        self.id = node_id\n        self.has_token = False\n        self.request_queue = []\n\nprint("[Cluster Boot] Initializing 4 node workers...")\nnode_1 = DistributedNode(1)\nprint(f"[Node {node_1.id}] Critical Section mutex acquired.")' },
        { id: 'f2', name: 'config.json', content: '{\n  "cluster_size": 4,\n  "algorithm": "Suzuki-Kasami",\n  "heartbeat_ms": 250\n}' }
      ]
    },
    {
      id: 'ws_2',
      name: 'OverflowGuard Runtime Security System',
      language: 'C++',
      files: [
        { id: 'f3', name: 'overflow_guard.cpp', content: '#include <iostream>\n#include <string>\n\nint main() {\n    std::cout << "[OverflowGuard] Memory boundary check initiated." << std::endl;\n    std::cout << "[Status] Stack protection canopy active." << std::endl;\n    return 0;\n}' }
      ]
    }
  ]);

  const [openTabs, setOpenTabs] = useState<FileItem[]>([]);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  const [code, setCode] = useState<string>('');
  const [stdin, setStdin] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Custom Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'workspace' | 'file'>('workspace');
  const [inputValue, setInputValue] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('Python');

  const handleOpenModal = (mode: 'workspace' | 'file') => {
    setModalMode(mode);
    setInputValue('');
    setIsModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (modalMode === 'workspace') {
      const newWs: Workspace = { 
        id: 'ws_' + Date.now(), 
        name: inputValue.trim(), 
        language: selectedLanguage, 
        files: [{ id: 'f_' + Date.now(), name: selectedLanguage === 'Python' ? 'main.py' : 'main.cpp', content: '# New workspace instance active\nprint("Engine Online")' }] 
      };
      setWorkspaces([...workspaces, newWs]);
    } else if (modalMode === 'file' && activeWorkspace) {
      const newFile = { id: 'f_' + Date.now(), name: inputValue.trim(), content: '// Modular unit implementation\n' };
      activeWorkspace.files.push(newFile);
      handleSelectFile(newFile);
    }

    setIsModalOpen(false);
  };

  const handleSelectFile = (file: FileItem) => {
    if (!openTabs.some((t) => t.id === file.id)) {
      setOpenTabs([...openTabs, file]);
    }
    setActiveFile(file);
    setCode(file.content);
  };

  const handleCloseTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTabs = openTabs.filter((t) => t.id !== fileId);
    setOpenTabs(updatedTabs);
    if (activeFile?.id === fileId) {
      if (updatedTabs.length > 0) {
        setActiveFile(updatedTabs[updatedTabs.length - 1]);
        setCode(updatedTabs[updatedTabs.length - 1].content);
      } else {
        setActiveFile(null);
        setCode('');
      }
    }
  };

  // Theme Selector Dropdown Component
  const renderThemeSelector = () => (
    <div className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/60 hover:border-slate-500 rounded-xl px-3 py-1.5 shadow-sm transition-all duration-300">
      <Icons.Palette />
      <select
        value={currentThemeKey}
        onChange={(e) => setCurrentThemeKey(e.target.value as ThemeKey)}
        className="bg-transparent text-xs font-mono font-bold text-slate-200 focus:outline-none cursor-pointer"
      >
        {Object.entries(THEMES).map(([key, item]) => (
          <option key={key} value={key} className="bg-slate-900 text-slate-200">
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );

  // Background Animated Code Lines Pattern Component
  const renderCodeBackground = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-20 font-mono text-[11px] leading-relaxed text-slate-400">
      <style>{`
        @keyframes floatCode1 {
          0% { transform: translateY(0px) translateX(0px); opacity: 0.15; }
          50% { transform: translateY(-30px) translateX(15px); opacity: 0.35; }
          100% { transform: translateY(0px) translateX(0px); opacity: 0.15; }
        }
        @keyframes floatCode2 {
          0% { transform: translateY(0px) translateX(0px); opacity: 0.2; }
          50% { transform: translateY(40px) translateX(-20px); opacity: 0.4; }
          100% { transform: translateY(0px) translateX(0px); opacity: 0.2; }
        }
        .code-float-1 { animation: floatCode1 12s ease-in-out infinite; }
        .code-float-2 { animation: floatCode2 16s ease-in-out infinite; }
      `}</style>
      
      {/* Floating Code Snippets */}
      <div className="code-float-1 absolute top-[12%] left-[5%] max-w-sm p-4 rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm">
        <pre className="text-cyan-400/70">
          {`async function acquireMutex(nodeId) {
  const token = await checkQueue();
  if (token.holder === null) {
    return await dispatchToken(nodeId);
  }
}`}
        </pre>
      </div>

      <div className="code-float-2 absolute bottom-[18%] right-[6%] max-w-sm p-4 rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm">
        <pre className="text-purple-400/70">
          {`template <typename T>
class MemoryBoundaryGuard {
  private:
    uint8_t canary[16];
  public:
    bool verifyIntegrity();
};`}
        </pre>
      </div>

      <div className="code-float-1 absolute top-[55%] left-[8%] max-w-xs p-3 rounded-xl border border-white/5 bg-slate-900/30 backdrop-blur-sm">
        <pre className="text-emerald-400/70">
          {`01000011 01101111 01100100
01100101 01010011 01111001
01101110 01100011 00100000`}
        </pre>
      </div>
    </div>
  );

  // Modern 3D Elevated Glass Modal
  const renderModal = () => {
    if (!isModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
        <div className={`bg-slate-900/95 border ${theme.border} rounded-3xl w-full max-w-md p-7 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative transform hover:scale-[1.01] transition-all duration-300`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 bg-slate-800/80 ${theme.textAccent} border ${theme.border} rounded-2xl`}>
                <Icons.Cube3D />
              </div>
              <h3 className="text-lg font-black text-slate-100 tracking-wide">
                {modalMode === 'workspace' ? 'Provision Cluster' : 'Initialize Module'}
              </h3>
            </div>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 hover:scale-110 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700/50"
            >
              <Icons.Close />
            </button>
          </div>

          <form onSubmit={handleModalSubmit} className="space-y-5">
            <div>
              <label className={`block text-[11px] font-black ${theme.textAccent} uppercase tracking-widest mb-2 font-mono`}>
                {modalMode === 'workspace' ? 'Workspace Name' : 'File Identifier'}
              </label>
              <input
                type="text"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={modalMode === 'workspace' ? 'e.g. Quantum Execution Node' : 'e.g. matrix_router.py'}
                className="w-full px-4 py-3 bg-slate-950/90 border border-slate-800 focus:border-slate-500 rounded-xl text-slate-200 text-sm focus:outline-none transition-all font-mono shadow-inner"
              />
            </div>

            {modalMode === 'workspace' && (
              <div>
                <label className={`block text-[11px] font-black ${theme.textAccent} uppercase tracking-widest mb-2 font-mono`}>
                  Runtime Environment
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950/90 border border-slate-800 focus:border-slate-500 rounded-xl text-slate-200 text-sm focus:outline-none transition-all font-mono cursor-pointer"
                >
                  <option value="Python">Python 3.11 Cyber-Kernel</option>
                  <option value="C++">C++20 High-Velocity Native</option>
                  <option value="Java">Java 21 Enterprise VM</option>
                  <option value="TypeScript">TypeScript Node-Matrix 20</option>
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-6 py-2.5 bg-gradient-to-r ${theme.buttonGradient} text-white text-xs font-extrabold rounded-xl shadow-lg hover:scale-105 transition-all cursor-pointer border border-white/10`}
              >
                Confirm Build
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // 1. DYNAMIC THEME LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500/30">
        <style>{`
          @keyframes gridMove {
            0% { transform: translateY(0); }
            100% { transform: translateY(60px); }
          }
          @keyframes floatUp {
            0% { transform: translateY(0) scale(1); opacity: 0; }
            20% { opacity: 0.8; }
            80% { opacity: 0.8; }
            100% { transform: translateY(-100vh) scale(1.5); opacity: 0; }
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.25; transform: scale(1); }
            50% { opacity: 0.45; transform: scale(1.15); }
          }
          .cyber-grid {
            background-size: 60px 60px;
            background-image: 
              linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
            animation: gridMove 2s linear infinite;
          }
          .particle-1 { animation: floatUp 8s ease-in-out infinite 0s; }
          .particle-2 { animation: floatUp 12s ease-in-out infinite 2s; }
          .particle-3 { animation: floatUp 10s ease-in-out infinite 4s; }
          .glow-pulse { animation: pulseGlow 6s ease-in-out infinite; }
        `}</style>

        {/* Dynamic Theme Glow Orbs */}
        <div className={`absolute top-1/4 left-1/4 w-[550px] h-[550px] ${theme.glowOrb1} rounded-full blur-[140px] pointer-events-none glow-pulse`} />
        <div className={`absolute bottom-1/4 right-1/4 w-[550px] h-[550px] ${theme.glowOrb2} rounded-full blur-[140px] pointer-events-none glow-pulse`} style={{ animationDelay: '-3s' }} />

        {/* Perspective Animated Cyber Grid Floor */}
        <div className="absolute inset-0 perspective-1000 overflow-hidden pointer-events-none">
          <div className="absolute inset-x-0 bottom-0 h-[80vh] origin-bottom transform rotate-x-60 cyber-grid opacity-60" />
        </div>

        {/* Floating Background Code Snippets */}
        {renderCodeBackground()}

        {/* Floating Particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="particle-1 absolute bottom-0 left-[20%] w-2 h-2 bg-slate-400 rounded-full" />
          <div className="particle-2 absolute bottom-0 left-[50%] w-1.5 h-1.5 bg-slate-500 rounded-full" />
          <div className="particle-3 absolute bottom-0 left-[80%] w-2.5 h-2.5 bg-slate-300 rounded-full" />
        </div>

        {/* Top-Right Theme Quick Selector */}
        <div className="absolute top-6 right-6 z-30">
          {renderThemeSelector()}
        </div>

        {/* Interactive 3D Glass Box with Hover Effects */}
        <div className={`w-full max-w-md ${theme.cardBg} backdrop-blur-3xl border ${theme.border} ${theme.hoverBorder} rounded-3xl p-9 shadow-[0_0_80px_rgba(0,0,0,0.9)] relative z-10 transform hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 ring-1 ring-white/10 group`}>
          <div className="flex items-center justify-center gap-4 mb-9">
            <div className={`p-3.5 bg-gradient-to-tr ${theme.buttonGradient} rounded-2xl shadow-lg ring-2 ring-white/20 transform group-hover:rotate-6 group-hover:scale-110 transition-all duration-300`}>
              <Icons.Code />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                CodeSync
              </h1>
              <p className={`text-[10px] ${theme.textAccent} font-mono font-bold tracking-widest uppercase`}>
                {theme.name} Edition
              </p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setIsLoggedIn(true); }} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">
                Developer Credentials
              </label>
              <input 
                type="email" 
                defaultValue="dev@codesync.io"
                required
                className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-800 focus:border-slate-500 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none hover:border-slate-700 transition-all text-sm font-mono shadow-inner" 
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">
                Security Key
              </label>
              <input 
                type="password" 
                defaultValue="••••••••" 
                required
                className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-800 focus:border-slate-500 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none hover:border-slate-700 transition-all text-sm font-mono shadow-inner" 
              />
            </div>

            <button 
              type="submit"
              className={`w-full py-4 px-4 bg-gradient-to-r ${theme.buttonGradient} text-white font-black tracking-wider rounded-xl shadow-lg hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 text-sm uppercase cursor-pointer border border-white/10 group/btn`}
            >
              <span>Access Environment</span>
              <Icons.ChevronRight />
            </button>
          </form>

          <div className="mt-9 pt-6 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Neural Core Online
            </span>
            <span>v3.0 Spatial</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. DASHBOARD WITH HOVER CARDS & CODE BACKGROUND
  if (!activeWorkspace) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-slate-700/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b ${theme.bgGradient} blur-3xl pointer-events-none`} />

        {/* Code Background Overlay */}
        {renderCodeBackground()}

        {renderModal()}

        {/* Header Navigation */}
        <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 bg-gradient-to-tr ${theme.buttonGradient} rounded-xl shadow-md hover:scale-105 transition-transform cursor-pointer`}>
                <Icons.Code />
              </div>
              <span className="font-black text-lg text-slate-100 tracking-tight">CodeSync Studio</span>
            </div>

            <div className="flex items-center gap-4">
              {renderThemeSelector()}
              <button 
                onClick={() => setIsLoggedIn(false)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/60 hover:border-slate-500 rounded-xl transition-all hover:scale-105 cursor-pointer shadow-sm"
              >
                <Icons.LogOut />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-100 tracking-tight">
                Cloud Execution Nodes
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Select a virtual node container or provision an isolated sandbox.
              </p>
            </div>
            
            <button
              onClick={() => handleOpenModal('workspace')}
              className={`flex items-center gap-2 bg-gradient-to-r ${theme.buttonGradient} text-white text-xs font-extrabold px-5 py-3 rounded-xl shadow-lg border border-white/10 hover:-translate-y-1 hover:scale-105 transition-all duration-300 cursor-pointer`}
            >
              <Icons.Plus />
              Provision Node
            </button>
          </div>

          {/* Grid Layout with Enhanced Card Hover Effects */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {workspaces.map((ws) => (
              <div 
                key={ws.id} 
                className={`bg-slate-900/40 backdrop-blur-md border ${theme.border} ${theme.hoverBorder} rounded-2xl p-7 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col justify-between group hover:-translate-y-2 hover:scale-[1.02] transform relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl ${theme.textAccent} group-hover:scale-110 shadow-inner transition-transform duration-300`}>
                      <Icons.Cube3D />
                    </div>
                    <span className={`text-[10px] uppercase font-mono tracking-widest font-bold bg-slate-800/80 ${theme.textAccent} border border-slate-700/60 group-hover:border-slate-500 px-3 py-1 rounded-lg transition-colors`}>
                      {ws.language}
                    </span>
                  </div>
                  
                  <h3 className="font-extrabold text-slate-100 group-hover:text-white transition-colors text-lg leading-snug">
                    {ws.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-2 font-mono">
                    <Icons.FileCode />
                    {ws.files.length} module(s) mounted
                  </p>
                </div>

                <div className="mt-10 pt-5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">NODE ID: {ws.id}</span>
                  <button
                    onClick={() => {
                      setActiveWorkspace(ws);
                      setOpenTabs([ws.files[0]]);
                      setActiveFile(ws.files[0]);
                      setCode(ws.files[0].content);
                    }}
                    className={`flex items-center gap-2 text-xs font-extrabold ${theme.textAccent} hover:underline transition-all cursor-pointer group-hover:translate-x-1`}
                  >
                    Launch Studio <Icons.ChevronRight />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 3. HIGH-TECH IDE WITH CODE CANVAS BACKGROUND & HOVER TABS
  const handleRunCode = () => {
    setIsExecuting(true);
    setOutput('Allocating isolated memory sandbox...\nCompiling binary target...');
    setTimeout(() => {
      setIsExecuting(false);
      setOutput(`[Execution Result]\n------------------------------------------------\n${code}\n\n------------------------------------------------\n[Process Terminated - Exit Code 0 | Exec Time: 8.4ms]`);
    }, 700);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-200 font-sans overflow-hidden selection:bg-slate-700/30">
      {renderModal()}
      
      {/* Top Header */}
      <header className="h-13 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between px-5 select-none shrink-0 backdrop-blur-xl z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveWorkspace(null)} 
            className="px-3.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 hover:border-slate-600 hover:scale-105 transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            ← Workspaces
          </button>
          <div className="h-4 w-px bg-slate-800"></div>
          <span className="text-xs font-black text-slate-100 tracking-wide">{activeWorkspace.name}</span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
            SANDBOX ONLINE
          </span>
        </div>

        <div className="flex items-center gap-3">
          {renderThemeSelector()}
          <button 
            onClick={handleRunCode} 
            disabled={isExecuting}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer ${
              isExecuting 
                ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800' 
                : `bg-gradient-to-r ${theme.buttonGradient} text-white hover:-translate-y-0.5 border border-white/10`
            }`}
          >
            <Icons.Play />
            {isExecuting ? 'Executing...' : 'Run Program'}
          </button>
        </div>
      </header>

      {/* Main Container Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Explorer Bar */}
        <aside className="w-64 bg-slate-950/60 border-r border-slate-800/80 flex flex-col shrink-0 select-none">
          <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase flex items-center gap-2 font-mono">
              <Icons.Folder /> FILE SYSTEM
            </span>
            <button
              onClick={() => handleOpenModal('file')}
              className="p-1 hover:bg-slate-800 hover:scale-110 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer border border-transparent hover:border-slate-700"
            >
              <Icons.Plus />
            </button>
          </div>

          <div className="p-2 space-y-1 overflow-y-auto flex-1">
            {activeWorkspace.files.map((f) => {
              const isActive = activeFile?.id === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => handleSelectFile(f)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer font-mono hover:translate-x-1 ${
                    isActive 
                      ? `bg-slate-900 ${theme.textAccent} border ${theme.border} font-bold shadow-sm` 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icons.FileCode />
                  <span className="truncate">{f.name}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center Canvas Workspace */}
        <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
          {/* Editor File Tabs with Hover Highlights */}
          <div className="h-10 bg-slate-900/40 border-b border-slate-800/80 flex items-center overflow-x-auto select-none scrollbar-none">
            {openTabs.map((tab) => {
              const isActive = activeFile?.id === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveFile(tab);
                    setCode(tab.content);
                  }}
                  className={`h-full flex items-center gap-2.5 px-4 border-r border-slate-800/80 text-xs font-mono cursor-pointer transition-all border-t-2 ${
                    isActive 
                      ? 'bg-black border-t-slate-300 text-slate-100 font-bold' 
                      : 'border-t-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-900/60 hover:border-t-slate-600'
                  }`}
                >
                  <Icons.FileCode />
                  <span>{tab.name}</span>
                  <button 
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-slate-200 hover:scale-110 transition-all"
                  >
                    <Icons.Close />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Code Editor Container with Coding Background Glow */}
          <div className="flex-1 relative flex overflow-hidden">
            {/* Subtle Line Number Gutter */}
            <div className="w-12 bg-slate-950/80 border-r border-slate-800/50 py-6 text-right pr-3 font-mono text-xs text-slate-600 select-none leading-relaxed opacity-60">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 bg-black/90 text-slate-200 p-6 font-mono text-sm resize-none focus:outline-none leading-relaxed border-none selection:bg-slate-700/40 z-10"
            />
          </div>
        </main>

        {/* Chat and Voice Panel */}
        <ChatAndVoicePanel
          socket={socket}
          roomId={activeWorkspace.id}
          currentUser="Easha"
        />

        {/* Right Output Terminal */}
        <aside className="w-80 bg-slate-950/60 border-l border-slate-800/80 flex flex-col shrink-0 select-none">
          <div className="p-3.5 border-b border-slate-800/80 flex items-center gap-2 text-[10px] font-black text-slate-400 tracking-widest uppercase font-mono">
            <Icons.Terminal /> SYSTEM CONSOLE
          </div>

          <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/80">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">
              Standard Input (stdin)
            </label>
            <input 
              type="text" 
              value={stdin} 
              onChange={(e) => setStdin(e.target.value)} 
              placeholder="Inject runtime flags..." 
              className="w-full px-3.5 py-2 bg-black border border-slate-800 focus:border-slate-600 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none transition-all shadow-inner" 
            />
          </div>

          <div className={`flex-1 p-4 bg-black font-mono text-xs ${theme.terminalText} overflow-y-auto leading-relaxed`}>
            <pre className="whitespace-pre-wrap font-mono">{output || '// System console standing by...'}</pre>
          </div>
        </aside>
      </div>

      {/* Dynamic Status Footer Bar */}
      <footer className={`h-7 bg-gradient-to-r ${theme.footerGradient} text-white flex items-center justify-between px-4 text-[11px] font-mono select-none shrink-0 font-extrabold shadow-md`}>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 hover:bg-white/10 px-2 py-0.5 rounded-lg transition-colors cursor-pointer">
            <Icons.GitBranch /> main*
          </span>
          <span className="flex items-center gap-1.5">
            <Icons.Cpu /> {theme.name} Active
          </span>
        </div>
        <div className="flex items-center gap-5">
          <span>Ln 1, Col 1</span>
          <span>UTF-8</span>
          <span className="uppercase tracking-wider">{activeWorkspace.language}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;