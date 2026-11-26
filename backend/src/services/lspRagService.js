import fs from 'fs';
import path from 'path';
import { getWorkspacePath } from '../utils/pathSandbox.js';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__']);
const CODE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.java', '.css', '.json', '.md', '.sql']);

const LANGUAGE_SNIPPETS = {
  javascript: [
    { label: 'async function', kind: 'snippet', detail: 'Async function declaration', insertText: 'async function name(params) {\n  \n}' },
    { label: 'try / catch', kind: 'snippet', detail: 'Error handling block', insertText: 'try {\n  \n} catch (err) {\n  console.error(err);\n}' },
    { label: 'console.log', kind: 'function', detail: 'Log to stdout', insertText: 'console.log()' },
    { label: 'fetch', kind: 'function', detail: 'HTTP Fetch API', insertText: 'const res = await fetch(url);' },
  ],
  typescript: [
    { label: 'interface', kind: 'keyword', detail: 'TypeScript interface', insertText: 'interface Name {\n  \n}' },
    { label: 'useEffect', kind: 'hook', detail: 'React useEffect hook', insertText: 'useEffect(() => {\n  \n}, []);' },
    { label: 'useState', kind: 'hook', detail: 'React useState hook', insertText: 'const [state, setState] = useState();' },
    { label: 'async function', kind: 'snippet', detail: 'Async typed function', insertText: 'async function name(): Promise<void> {\n  \n}' },
  ],
  python: [
    { label: 'def', kind: 'keyword', detail: 'Python function', insertText: 'def name(arg):\n    pass' },
    { label: 'class', kind: 'keyword', detail: 'Python class', insertText: 'class Name:\n    def __init__(self):\n        pass' },
    { label: 'if __name__ == "__main__"', kind: 'snippet', detail: 'Entrypoint guard', insertText: 'if __name__ == "__main__":\n    main()' },
  ],
};

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9_]{2,}/g) || []);
}

class LspRagService {
  constructor() {
    this.cache = new Map(); // workspaceId -> { indexedAt, symbols, chunks, files }
  }

  async indexWorkspace(workspaceId, force = false) {
    const existing = this.cache.get(workspaceId);
    if (!force && existing && Date.now() - existing.indexedAt < 8000) {
      return existing;
    }

    const rootDir = getWorkspacePath(workspaceId);
    const symbols = [];
    const chunks = [];
    const files = [];

    if (!fs.existsSync(rootDir)) {
      const empty = { indexedAt: Date.now(), symbols, chunks, files };
      this.cache.set(workspaceId, empty);
      return empty;
    }

    const walk = (dir, rel = '') => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(full, relPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!CODE_EXTS.has(ext)) continue;
          try {
            const stat = fs.statSync(full);
            if (stat.size > 512 * 1024) continue;
            const content = fs.readFileSync(full, 'utf8');
            files.push(relPath);
            this._extractSymbols(relPath, content, symbols);
            this._chunkFile(relPath, content, chunks);
          } catch {
            // ignore unreadable files
          }
        }
      }
    };

    walk(rootDir);
    const indexData = { indexedAt: Date.now(), symbols, chunks, files };
    this.cache.set(workspaceId, indexData);
    return indexData;
  }

  _extractSymbols(filePath, content, symbols) {
    const lines = content.split('\n');
    const patterns = [
      { kind: 'function', rx: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/ },
      { kind: 'const', rx: /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?([^)=]*)\)?\s*=>/ },
      { kind: 'class', rx: /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/ },
      { kind: 'interface', rx: /^\s*(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/ },
      { kind: 'function', rx: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/ },
      { kind: 'class', rx: /^\s*(?:public\s+|private\s+)?class\s+([A-Za-z_]\w*)/ },
    ];

    lines.forEach((line, idx) => {
      for (const p of patterns) {
        const m = line.match(p.rx);
        if (m) {
          symbols.push({
            name: m[1],
            kind: p.kind,
            filePath,
            line: idx + 1,
            signature: line.trim().slice(0, 120),
          });
          break;
        }
      }
    });
  }

  _chunkFile(filePath, content, chunks) {
    const lines = content.split('\n');
    const CHUNK_SIZE = 35;
    const OVERLAP = 10;
    for (let start = 0; start < lines.length; start += (CHUNK_SIZE - OVERLAP)) {
      const slice = lines.slice(start, start + CHUNK_SIZE);
      const text = slice.join('\n').trim();
      if (text.length < 15) continue;
      chunks.push({
        filePath,
        startLine: start + 1,
        endLine: Math.min(start + CHUNK_SIZE, lines.length),
        text,
        tokens: tokenize(`${filePath} ${text}`),
      });
      if (start + CHUNK_SIZE >= lines.length) break;
    }
  }

  async getCompletions(workspaceId, { prefix = '', language = 'javascript' }) {
    const index = await this.indexWorkspace(workspaceId);
    const cleanPrefix = prefix.trim().toLowerCase();

    const symbolItems = index.symbols
      .filter(s => !cleanPrefix || s.name.toLowerCase().startsWith(cleanPrefix) || s.name.toLowerCase().includes(cleanPrefix))
      .slice(0, 20)
      .map(s => ({
        label: s.name,
        kind: s.kind,
        detail: `${s.filePath}:${s.line}`,
        insertText: s.name,
        documentation: s.signature,
      }));

    const langKey = language.includes('ts') ? 'typescript' : language.includes('py') ? 'python' : 'javascript';
    const langItems = (LANGUAGE_SNIPPETS[langKey] || LANGUAGE_SNIPPETS.javascript)
      .filter(s => !cleanPrefix || s.label.toLowerCase().includes(cleanPrefix));

    const seen = new Set();
    const merged = [];
    for (const item of [...symbolItems, ...langItems]) {
      if (!seen.has(item.label)) {
        seen.add(item.label);
        merged.push(item);
      }
    }
    return merged.slice(0, 25);
  }

  async getInlineSuggestion(workspaceId, { filePath = '', content = '', cursorOffset = 0, language = 'javascript' }) {
    const before = content.slice(0, cursorOffset);
    const after = content.slice(cursorOffset);
    const currentLine = before.split('\n').pop() || '';
    const lineAfter = after.split('\n')[0] || '';

    // Only suggest at end of line (or before whitespace/closing delimiter)
    if (lineAfter.trim().length > 0 && !/^[\s)\]}'";,]+$/.test(lineAfter)) {
      return { suggestion: '' };
    }

    const trimmedLine = currentLine.trim();
    if (trimmedLine.length < 2) {
      return { suggestion: '' };
    }

    // 1. Check workspace-indexed symbols & snippets for fast prefix match
    const wordMatch = currentLine.match(/([A-Za-z_$][\w$]*)$/);
    const wordPrefix = wordMatch ? wordMatch[1] : '';

    if (wordPrefix.length >= 2) {
      const index = await this.indexWorkspace(workspaceId);
      const lower = wordPrefix.toLowerCase();

      // Exact workspace symbol prefix match (returns suffix only)
      const sym = index.symbols.find(s =>
        s.name.toLowerCase().startsWith(lower) && s.name.length > wordPrefix.length
      );
      if (sym) {
        // Extract parameter list if it's a function signature
        const sigMatch = sym.signature.match(new RegExp(`${sym.name}\\s*(\\([^)]*\\))`));
        const suffix = sym.name.slice(wordPrefix.length) + (sigMatch ? sigMatch[1] : '');
        return { suggestion: suffix, source: `lsprag:${sym.filePath}:${sym.line}` };
      }

      // Language snippet prefix match
      const langKey = language.includes('ts') ? 'typescript' : language.includes('py') ? 'python' : 'javascript';
      const snippets = LANGUAGE_SNIPPETS[langKey] || LANGUAGE_SNIPPETS.javascript;
      const snip = snippets.find(s =>
        s.insertText.toLowerCase().startsWith(lower) && s.insertText.length > wordPrefix.length
      );
      if (snip) {
        return { suggestion: snip.insertText.slice(wordPrefix.length), source: 'lsprag:snippet' };
      }
    }

    // 2. Common line-level contextual idioms (zero-latency)
    if (/^\s*(import\s+\{[^}]*)$/i.test(currentLine) && !currentLine.includes('from')) {
      return { suggestion: ` } from './';`, source: 'lsprag:idiom' };
    }
    if (/^\s*console\.l$/i.test(currentLine)) {
      return { suggestion: `og();`, source: 'lsprag:idiom' };
    }
    if (/^\s*try\s*$/.test(currentLine)) {
      return { suggestion: ` {\n  \n} catch (err) {\n  console.error(err);\n}`, source: 'lsprag:idiom' };
    }

    // 3. Optional Gemini RAG inline completion when API key is configured
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (apiKey && trimmedLine.length >= 4) {
      try {
        const index = await this.indexWorkspace(workspaceId);
        const qTokens = tokenize(trimmedLine);
        const topChunks = index.chunks
          .map(c => ({
            ...c,
            score: qTokens.reduce((acc, qt) => acc + (c.tokens.includes(qt) ? 1 : 0), 0),
          }))
          .filter(c => c.score > 0 && c.filePath !== filePath)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2)
          .map(c => `// ${c.filePath}:${c.startLine}\n${c.text.slice(0, 400)}`)
          .join('\n\n');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{
                text: `Complete ONLY the immediate next tokens/line after <CURSOR> for this ${language} file (${filePath}). Return raw completion text only, no markdown fences, max 120 chars.\n\nContext:\n${topChunks}\n\nCode:\n${before.slice(-800)}<CURSOR>`,
              }],
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 64 },
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          const raw = (json?.candidates?.[0]?.content?.parts?.[0]?.text || '')
            .replace(/^```[\w]*\n?/, '')
            .replace(/```$/, '');
          if (raw && raw.length <= 160) {
            return { suggestion: raw, source: 'lsprag:rag' };
          }
        }
      } catch {
        // ignore network errors for inline completions
      }
    }

    return { suggestion: '' };
  }

  async findDefinition(workspaceId, symbolName) {
    if (!symbolName || !symbolName.trim()) return [];
    const index = await this.indexWorkspace(workspaceId);
    const q = symbolName.trim();
    const exact = index.symbols.filter(s => s.name === q);
    if (exact.length > 0) return exact;
    return index.symbols.filter(s => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  }

  runDiagnostics({ filePath = '', content = '' }) {
    const diagnostics = [];
    const lines = content.split('\n');

    // 1. Bracket / Brace / Paren balance check
    const stack = [];
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const closers = { ')': '(', ']': '[', '}': '{' };

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (pairs[ch]) {
          stack.push({ ch, line: lineNum, col: c + 1 });
        } else if (closers[ch]) {
          const top = stack.pop();
          if (!top || top.ch !== closers[ch]) {
            diagnostics.push({
              severity: 'error',
              line: lineNum,
              col: c + 1,
              message: `Unmatched closing '${ch}'`,
              source: 'LSPRag Syntax',
            });
          }
        }
      }

      if (/\b(TODO|FIXME)\b/.test(line)) {
        diagnostics.push({
          severity: 'info',
          line: lineNum,
          col: 1,
          message: line.trim(),
          source: 'LSPRag Annotation',
        });
      }

      if (/(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,})/.test(line)) {
        diagnostics.push({
          severity: 'warning',
          line: lineNum,
          col: 1,
          message: 'Potential hardcoded credential detected — move to Cred Vault.',
          source: 'LSPRag Security',
        });
      }
    });

    while (stack.length > 0) {
      const unclosed = stack.pop();
      diagnostics.push({
        severity: 'error',
        line: unclosed.line,
        col: unclosed.col,
        message: `Unclosed '${unclosed.ch}'`,
        source: 'LSPRag Syntax',
      });
    }

    return {
      filePath,
      count: diagnostics.length,
      diagnostics: diagnostics.slice(0, 50),
    };
  }

  async queryRag(workspaceId, { query = '', activeFilePath = '', activeFileContent = '' }) {
    const index = await this.indexWorkspace(workspaceId, true);
    const qTokens = tokenize(query);

    // Score chunks with TF-IDF-like term frequency + symbol match boost
    const scored = index.chunks.map(chunk => {
      let score = 0;
      const tokenSet = new Set(chunk.tokens);
      for (const qt of qTokens) {
        if (tokenSet.has(qt)) score += 3;
        for (const ct of chunk.tokens) {
          if (ct.includes(qt) && ct !== qt) score += 0.5;
        }
      }
      if (activeFilePath && chunk.filePath === activeFilePath) score += 1.5;
      return { ...chunk, score };
    })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const matchingSymbols = index.symbols
      .filter(s => qTokens.some(qt => s.name.toLowerCase().includes(qt)))
      .slice(0, 8);

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    let answer = '';

    if (apiKey && (scored.length > 0 || activeFileContent)) {
      try {
        const contextText = scored
          .map(c => `File: ${c.filePath} (L${c.startLine}-${c.endLine})\n${c.text}`)
          .join('\n\n---\n\n');
        const activeCtx = activeFilePath
          ? `\nActive File (${activeFilePath}):\n${activeFileContent.slice(0, 2000)}`
          : '';

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{
                text: `You are CodeSync LSPRag, an expert codebase assistant. Answer the developer's question strictly grounded in the retrieved workspace snippets.\n\nQuestion: ${query}\n\nRetrieved Context:\n${contextText}${activeCtx}`,
              }],
            }],
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          answer = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch {
        // fallback to deterministic synthesis
      }
    }

    if (!answer) {
      if (scored.length === 0 && matchingSymbols.length === 0) {
        answer = `Indexed ${index.files.length} workspace files and ${index.symbols.length} symbols, but no direct matches were found for "${query}". Try searching by a function, route, or component name.`;
      } else {
        const symbolSummary = matchingSymbols.length > 0
          ? `**Matching Symbols:**\n${matchingSymbols.map(s => `- \`${s.name}\` (${s.kind}) in \`${s.filePath}:${s.line}\``).join('\n')}\n\n`
          : '';
        const chunkSummary = scored.length > 0
          ? `**Relevant Code Locations:**\n${scored.map(c => `- \`${c.filePath}\` (Lines ${c.startLine}–${c.endLine})`).join('\n')}`
          : '';
        answer = `${symbolSummary}${chunkSummary}`;
      }
    }

    return {
      query,
      answer,
      indexedFiles: index.files.length,
      indexedSymbols: index.symbols.length,
      citations: scored.map(c => ({
        filePath: c.filePath,
        startLine: c.startLine,
        endLine: c.endLine,
        snippet: c.text.split('\n').slice(0, 6).join('\n'),
        score: Math.round(c.score * 10) / 10,
      })),
      symbols: matchingSymbols,
    };
  }
}

export const lspRagService = new LspRagService();
