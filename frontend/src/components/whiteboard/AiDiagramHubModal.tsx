import { useState } from 'react';
import {
  Sparkles,
  Code2,
  Layers,
  X,
  Copy,
  Check,
  FileCode,
  AlertTriangle,
  Lock,
  ArrowRight,
  FolderPlus,
} from 'lucide-react';
import type { CanvasElement } from '../../types/whiteboard';
import { Spinner } from '../ui/Spinner';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

interface Props {
  workspaceId: string;
  workspaceType: 'educational' | 'professional' | 'competitive';
  userRole: string;
  sessionRole?: string;
  currentElements: CanvasElement[];
  onAddElements: (elements: CanvasElement[]) => void;
  onOpenFileInIDE?: (filePath: string) => void;
  onClose: () => void;
}

const STARTER_PROMPTS = [
  'Microservices e-commerce system with API Gateway, Auth Service, Product Catalog, Payment Service, and PostgreSQL',
  'User Authentication & JWT verification workflow: Client -> Gateway -> Auth Service -> Redis Cache',
  'Event-driven order fulfillment: Order Service -> Kafka Queue -> Payment Worker -> Notification Service',
  'URL Shortener system design with API Gateway, Redis Cache, Postgres DB, and Click Analytics Worker',
  'E-commerce relational database schema: Users, Orders, OrderItems, Products, and Payments',
];

export function AiDiagramHubModal({
  workspaceId,
  workspaceType,
  userRole,
  sessionRole,
  currentElements,
  onAddElements,
  onOpenFileInIDE,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<'text-to-diagram' | 'diagram-to-code'>('text-to-diagram');

  // Text to Diagram state
  const [diagramPrompt, setDiagramPrompt] = useState(STARTER_PROMPTS[0]);
  const [diagramType, setDiagramType] = useState('architecture');
  const [generatingDiagram, setGeneratingDiagram] = useState(false);
  const [generatedElements, setGeneratedElements] = useState<CanvasElement[] | null>(null);
  const [diagramError, setDiagramError] = useState('');

  // Diagram to Code state
  const [codeSource, setCodeSource] = useState<'canvas' | 'prompt'>('canvas');
  const [codePrompt, setCodePrompt] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [codeType, setCodeType] = useState('full');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [suggestedFilename, setSuggestedFilename] = useState('architecture.ts');
  const [codeSummary, setCodeSummary] = useState('');
  const [codeError, setCodeError] = useState('');
  const [copied, setCopied] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [fileCreatedToast, setFileCreatedToast] = useState('');

  // Access control check: in educational mode, only teacher has access!
  const isEducationalStudent =
    workspaceType === 'educational' &&
    userRole !== 'teacher' &&
    sessionRole !== 'teacher' &&
    userRole !== 'owner';

  const token = localStorage.getItem('codesync_token');

  // ─── Generate Diagram from Text ──────────────────────────────────────────
  const handleGenerateDiagram = async () => {
    if (!diagramPrompt.trim()) return;
    setGeneratingDiagram(true);
    setDiagramError('');
    setGeneratedElements(null);

    try {
      const res = await fetch(`${BASE_URL}/api/whiteboards/ai/text-to-diagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: diagramPrompt.trim(),
          diagramType,
          workspaceId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate diagram');
      }

      setGeneratedElements(data.elements || []);
    } catch (err: any) {
      setDiagramError(err.message || 'Failed to generate diagram');
    } finally {
      setGeneratingDiagram(false);
    }
  };

  const handleInsertDiagram = () => {
    if (!generatedElements || generatedElements.length === 0) return;
    onAddElements(generatedElements);
    onClose();
  };

  // ─── Generate Code from Diagram ──────────────────────────────────────────
  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    setCodeError('');
    setGeneratedCode(null);
    setFileCreatedToast('');

    const elementsToSend = codeSource === 'canvas' ? currentElements : [];
    const promptToSend =
      codeSource === 'prompt' ? codePrompt : codePrompt.trim() || 'Generate full implementation matching the whiteboard diagram.';

    try {
      const res = await fetch(`${BASE_URL}/api/whiteboards/ai/diagram-to-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          elements: elementsToSend,
          prompt: promptToSend,
          language,
          codeType,
          workspaceId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate code');
      }

      setGeneratedCode(data.code || '');
      setSuggestedFilename(data.suggestedFilename || `generated_${language}.txt`);
      setCodeSummary(data.summary || '');
    } catch (err: any) {
      setCodeError(err.message || 'Failed to generate code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateFileInWorkspace = async () => {
    if (!generatedCode) return;
    setCreatingFile(true);
    setFileCreatedToast('');

    try {
      const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          filePath: suggestedFilename,
          isDirectory: false,
        }),
      });

      if (!res.ok && res.status !== 409) {
        throw new Error('Failed to create file in workspace');
      }

      // Write code contents into file
      await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/files/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          filePath: suggestedFilename,
          content: generatedCode,
        }),
      });

      setFileCreatedToast(`Successfully created ${suggestedFilename}! Opening in IDE...`);
      setTimeout(() => {
        if (onOpenFileInIDE) {
          onOpenFileInIDE(suggestedFilename);
        }
        onClose();
      }, 1200);
    } catch (err: any) {
      alert(`Failed to save file: ${err.message}`);
    } finally {
      setCreatingFile(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0d131f] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#090d15] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">AI Diagram & Code Hub</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Whiteboard AI
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Generate dynamic architecture diagrams from text and convert diagrams directly into production code
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access Gating for Students in Educational Workspaces */}
        {isEducationalStudent ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-white">Teacher Only Feature</h3>
            <p className="text-xs text-gray-400 max-w-md">
              AI text-to-diagram and diagram-to-code synthesis is restricted to teachers in educational workspaces to maintain focused classroom instruction.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg"
            >
              Back to Whiteboard
            </button>
          </div>
        ) : (
          <>
            {/* Tabs Bar */}
            <div className="flex items-center border-b border-gray-800 bg-[#0b101a] px-6 shrink-0">
              <button
                onClick={() => setActiveTab('text-to-diagram')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'text-to-diagram'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>✨ Text → Diagram Generator</span>
              </button>

              <button
                onClick={() => setActiveTab('diagram-to-code')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'diagram-to-code'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>⚡ Diagram / Text → Code Generator</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ─── TAB 1: Text → Diagram ──────────────────────────────── */}
              {activeTab === 'text-to-diagram' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Describe the System or Architecture Prompt
                        </label>
                        <textarea
                          rows={4}
                          value={diagramPrompt}
                          onChange={(e) => setDiagramPrompt(e.target.value)}
                          placeholder="e.g. Microservices architecture with API Gateway, Auth, Postgres, and Redis..."
                          className="w-full bg-[#131b29] border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      {/* Quick starter chips */}
                      <div>
                        <span className="text-[11px] font-medium text-gray-400 block mb-1.5">
                          Or try an architectural template:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {STARTER_PROMPTS.map((prompt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setDiagramPrompt(prompt)}
                              className="text-[10px] px-2.5 py-1 bg-[#131b29] hover:bg-[#1a2538] text-gray-300 hover:text-white border border-gray-800 rounded-lg text-left truncate max-w-[280px]"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Diagram settings */}
                    <div className="bg-[#131b29] border border-gray-800 rounded-xl p-4 space-y-3 h-fit">
                      <h4 className="text-xs font-bold text-gray-300">Diagram Style</h4>
                      <div className="space-y-1.5 text-xs">
                        {[
                          { id: 'architecture', label: '🏗️ Microservices Architecture' },
                          { id: 'flowchart', label: '🔀 Workflow & Flowchart' },
                          { id: 'database', label: '🗄️ Database ER Diagram' },
                          { id: 'event_driven', label: '⚡ Event-Driven Streams' },
                        ].map((d) => (
                          <label
                            key={d.id}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                              diagramType === d.id
                                ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium'
                                : 'bg-[#0f1724] border-gray-800/80 text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name="diagramType"
                              value={d.id}
                              checked={diagramType === d.id}
                              onChange={(e) => setDiagramType(e.target.value)}
                              className="hidden"
                            />
                            <span>{d.label}</span>
                          </label>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateDiagram}
                        disabled={generatingDiagram || !diagramPrompt.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {generatingDiagram ? <Spinner size={14} /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>{generatingDiagram ? 'Synthesizing...' : 'Generate with AI'}</span>
                      </button>
                    </div>
                  </div>

                  {diagramError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{diagramError}</span>
                    </div>
                  )}

                  {/* Generated Diagram Preview */}
                  {generatedElements && (
                    <div className="mt-4 p-4 bg-[#131b29] border border-indigo-500/40 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">
                            Generated {generatedElements.filter((e) => e.type !== 'connector').length} Nodes &{' '}
                            {generatedElements.filter((e) => e.type === 'connector').length} Connectors
                          </span>
                        </div>

                        <button
                          onClick={handleInsertDiagram}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
                        >
                          <span>Insert into Whiteboard</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
                        {generatedElements
                          .filter((e) => e.type !== 'connector')
                          .map((el) => (
                            <div
                              key={el.id}
                              className="p-2.5 rounded-lg bg-[#0d131f] border text-xs"
                              style={{ borderColor: el.strokeColor || '#388bfd' }}
                            >
                              <div className="font-semibold text-white truncate">{el.text}</div>
                              <div className="text-[10px] text-gray-400 capitalize">{el.diagramType || el.type}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB 2: Diagram / Text → Code ────────────────────────── */}
              {activeTab === 'diagram-to-code' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      {/* Source choice */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-gray-300">Code Source:</span>
                        <div className="flex items-center rounded-lg border border-gray-800 bg-[#131b29] p-0.5">
                          <button
                            type="button"
                            onClick={() => setCodeSource('canvas')}
                            className={`px-3 py-1 rounded transition-colors ${
                              codeSource === 'canvas'
                                ? 'bg-indigo-600 text-white font-medium'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Current Whiteboard ({currentElements.filter((e) => e.type !== 'connector').length} nodes)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCodeSource('prompt')}
                            className={`px-3 py-1 rounded transition-colors ${
                              codeSource === 'prompt'
                                ? 'bg-indigo-600 text-white font-medium'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Custom Feature Prompt
                          </button>
                        </div>
                      </div>

                      {codeSource === 'prompt' ? (
                        <textarea
                          rows={4}
                          value={codePrompt}
                          onChange={(e) => setCodePrompt(e.target.value)}
                          placeholder="Describe the software component, schema, or API routes to generate..."
                          className="w-full bg-[#131b29] border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                        />
                      ) : (
                        <div className="p-3 bg-[#131b29] border border-gray-800 rounded-xl text-xs text-gray-300 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white">Whiteboard Architecture Synced</span>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Extracting all active services, gateways, databases, and relationships directly from your canvas.
                            </p>
                          </div>
                          <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20 text-[10px]">
                            {currentElements.length} elements
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-300 mb-1">Target Language</label>
                          <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full bg-[#131b29] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                          >
                            <option value="typescript">TypeScript (Express Router & Services)</option>
                            <option value="javascript">JavaScript (Node.js & Express)</option>
                            <option value="python">Python (FastAPI & Pydantic)</option>
                            <option value="sql">SQL (PostgreSQL / MySQL Schema DDL)</option>
                            <option value="java">Java (Spring Boot Controller)</option>
                          </select>
                        </div>

                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-300 mb-1">Code Type</label>
                          <select
                            value={codeType}
                            onChange={(e) => setCodeType(e.target.value)}
                            className="w-full bg-[#131b29] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                          >
                            <option value="full">Complete Architecture Boilerplate</option>
                            <option value="routes">API Endpoints & Controllers</option>
                            <option value="models">Database Schema & Models</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Action button card */}
                    <div className="bg-[#131b29] border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-300">Code Synthesis</h4>
                        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                          AI will analyze the diagram nodes, protocols, and database entities to generate clean, executable code.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateCode}
                        disabled={generatingCode}
                        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {generatingCode ? <Spinner size={14} /> : <Code2 className="w-3.5 h-3.5" />}
                        <span>{generatingCode ? 'Writing Code...' : 'Generate Code'}</span>
                      </button>
                    </div>
                  </div>

                  {codeError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{codeError}</span>
                    </div>
                  )}

                  {fileCreatedToast && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{fileCreatedToast}</span>
                    </div>
                  )}

                  {/* Generated Code Display */}
                  {generatedCode && (
                    <div className="mt-4 rounded-xl border border-gray-800 overflow-hidden bg-[#090d15]">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-[#0d131f]">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-bold text-white font-mono">{suggestedFilename}</span>
                          {codeSummary && <span className="text-[11px] text-gray-400 hidden sm:inline">- {codeSummary}</span>}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied!' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCreateFileInWorkspace}
                            disabled={creatingFile}
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                          >
                            {creatingFile ? <Spinner size={12} /> : <FolderPlus className="w-3.5 h-3.5" />}
                            <span>Save to Workspace File</span>
                          </button>
                        </div>
                      </div>

                      <pre className="p-4 text-xs font-mono text-gray-200 overflow-x-auto max-h-72 overflow-y-auto leading-relaxed bg-[#06090e]">
                        <code>{generatedCode}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}