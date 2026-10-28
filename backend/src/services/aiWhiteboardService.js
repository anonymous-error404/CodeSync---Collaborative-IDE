/**
 * AI Whiteboard Service
 * Powers AI Text-to-Diagram generation and Diagram/Text-to-Code synthesis.
 * Supports Google Gemini API (gemini-1.5-flash) with an intelligent built-in synthesizer fallback.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

// Node colors and dimensions per diagram type
const PALETTE = {
  client: { stroke: '#58a6ff', fill: '#161b22', icon: '💻', w: 160, h: 70 },
  gateway: { stroke: '#2f81f7', fill: '#161b22', icon: '🌐', w: 160, h: 70 },
  service: { stroke: '#3fb950', fill: '#161b22', icon: '⚙️', w: 170, h: 75 },
  database: { stroke: '#d29922', fill: '#161b22', icon: '🛢️', w: 150, h: 80 },
  cache: { stroke: '#f0883e', fill: '#161b22', icon: '⚡', w: 140, h: 70 },
  queue: { stroke: '#a371f7', fill: '#161b22', icon: '📨', w: 150, h: 70 },
  worker: { stroke: '#79c0ff', fill: '#161b22', icon: '🔄', w: 160, h: 70 },
  external: { stroke: '#7d8590', fill: '#161b22', icon: '🔌', w: 150, h: 70 },
  decision: { stroke: '#f0883e', fill: '#161b22', icon: '❓', w: 140, h: 70 },
};

/**
 * Validate role permissions for AI whiteboard tools:
 * - educational: accessible ONLY by teacher
 * - professional & competitive: accessible by all members
 */
export function checkAiAccess(workspaceType, userRole, sessionRole) {
  if (workspaceType === 'educational') {
    const isTeacher = userRole === 'teacher' || sessionRole === 'teacher' || userRole === 'owner';
    if (!isTeacher) {
      const err = new Error('AI diagram and code tools are accessible only by the teacher in educational workspaces.');
      err.status = 403;
      throw err;
    }
  }
}

/**
 * AI Text-to-Diagram Generator
 */
export async function generateDiagramFromText({ prompt, diagramType = 'architecture', workspaceType, userRole, sessionRole }) {
  checkAiAccess(workspaceType, userRole, sessionRole);

  if (!prompt || !prompt.trim()) {
    throw new Error('Prompt is required for diagram generation');
  }

  // Attempt Gemini API call if key is available
  if (GEMINI_API_KEY) {
    try {
      const geminiResult = await callGeminiForDiagram(prompt.trim(), diagramType);
      if (geminiResult && geminiResult.length > 0) {
        return geminiResult;
      }
    } catch (err) {
      console.warn('[AI Whiteboard] Gemini API error, falling back to intelligent synthesizer:', err.message);
    }
  }

  // Intelligent Built-in Synthesizer Fallback
  return synthesizeDiagramLocally(prompt.trim(), diagramType);
}

/**
 * AI Diagram/Text-to-Code Generator
 */
export async function generateCodeFromDiagram({ elements = [], prompt = '', language = 'typescript', codeType = 'full', workspaceType, userRole, sessionRole }) {
  checkAiAccess(workspaceType, userRole, sessionRole);

  const cleanLang = (language || 'typescript').toLowerCase();
  const diagramSummary = summarizeElements(elements);

  if (!prompt.trim() && elements.length === 0) {
    throw new Error('Please provide either diagram elements or a prompt to generate code');
  }

  // Attempt Gemini API call if key is available
  if (GEMINI_API_KEY) {
    try {
      const geminiResult = await callGeminiForCode(elements, prompt.trim(), cleanLang, codeType);
      if (geminiResult && geminiResult.code) {
        return geminiResult;
      }
    } catch (err) {
      console.warn('[AI Whiteboard] Gemini Code generation error, falling back to intelligent synthesizer:', err.message);
    }
  }

  // Intelligent Built-in Code Synthesizer Fallback
  return synthesizeCodeLocally(elements, prompt.trim(), cleanLang, codeType, diagramSummary);
}

// ─── Gemini Integration ────────────────────────────────────────────────────────

async function callGeminiForDiagram(prompt, diagramType) {
  const systemPrompt = `You are an expert system architect and software diagram generator.
Convert the user description into a clean 2D whiteboard diagram structure with layout coordinates.
Return ONLY valid JSON matching this schema:
{
  "elements": [
    {
      "id": "node-1",
      "type": "rectangle",
      "x": 100,
      "y": 120,
      "width": 170,
      "height": 75,
      "text": "💻 Client App",
      "strokeColor": "#58a6ff",
      "fillColor": "#161b22",
      "strokeWidth": 2,
      "diagramType": "client"
    },
    {
      "id": "conn-1",
      "type": "connector",
      "sourceId": "node-1",
      "targetId": "node-2",
      "text": "HTTP/REST",
      "strokeColor": "#388bfd"
    }
  ]
}
Available diagramTypes: client, gateway, service, database, cache, queue, worker, external, decision.
Keep x coordinates spaced by 220px horizontally and y coordinates spaced by 120px vertically. Connect logical components with connectors.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser Diagram Request:\nType: ${diagramType}\n${prompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  const parsed = JSON.parse(rawText);
  return Array.isArray(parsed) ? parsed : parsed.elements || [];
}

async function callGeminiForCode(elements, prompt, language, codeType) {
  const summary = summarizeElements(elements);
  const sysPrompt = `You are a Principal Software Engineer.
Generate production-ready, clean, well-typed ${language} code based on the provided software diagram or user requirements.
Return JSON with:
{
  "code": "/* the complete generated code string */",
  "language": "${language}",
  "suggestedFilename": "filename_with_extension",
  "summary": "Brief 1-2 sentence explanation of generated code"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${sysPrompt}\n\nDiagram Architecture Summary:\n${summary}\n\nUser Extra Instructions:\n${prompt}\nTarget Code Type: ${codeType}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini Code API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  return JSON.parse(rawText);
}

// ─── Intelligent Built-in Synthesizers (Offline / Fallback) ────────────────────

function classifyKeyword(word) {
  const lower = word.toLowerCase();
  if (lower.match(/client|frontend|browser|user|mobile|react|app|web|ui/)) return 'client';
  if (lower.match(/gateway|ingress|proxy|router|nginx|load balancer/)) return 'gateway';
  if (lower.match(/db|database|sql|postgres|mongo|mysql|sqlite|store|dynamo/)) return 'database';
  if (lower.match(/cache|redis|memcache/)) return 'cache';
  if (lower.match(/queue|kafka|rabbit|sqs|pubsub|event|stream/)) return 'queue';
  if (lower.match(/worker|cron|consumer|job|process/)) return 'worker';
  if (lower.match(/external|stripe|thirdparty|payment|smtp|email|twilio/)) return 'external';
  if (lower.match(/if|check|validate|is_|decision|decision\?/)) return 'decision';
  return 'service';
}

function synthesizeDiagramLocally(prompt, diagramType) {
  const timestamp = Date.now();
  const elements = [];

  // Split on connectors or clauses
  const tokens = prompt
    .replace(/(->|-->|=>|connects to|calls|queries|publishes to|subscribes to|reads from|writes to|then)/gi, ' -> ')
    .split(/->|\n|,|\./)
    .map(s => s.trim())
    .filter(Boolean);

  const parsedNodes = [];
  const seenLabels = new Set();

  for (const token of tokens) {
    const clean = token.replace(/^[-\*\d\.\s]+/, '').trim();
    if (!clean || seenLabels.has(clean.toLowerCase())) continue;
    seenLabels.add(clean.toLowerCase());
    const kind = classifyKeyword(clean);
    parsedNodes.push({
      label: clean.charAt(0).toUpperCase() + clean.slice(1),
      kind,
    });
  }

  if (parsedNodes.length === 0) {
    parsedNodes.push(
      { label: 'Client (Web / Mobile)', kind: 'client' },
      { label: 'API Gateway', kind: 'gateway' },
      { label: 'Core Backend Service', kind: 'service' },
      { label: 'PostgreSQL Database', kind: 'database' },
      { label: 'Redis Cache', kind: 'cache' }
    );
  }

  // Arrange in clean grid / tiered layout
  const startX = 120;
  const startY = 160;
  const colGap = 240;
  const rowGap = 130;
  const maxPerRow = 3;

  const nodeElements = [];

  parsedNodes.forEach((node, idx) => {
    const style = PALETTE[node.kind] || PALETTE.service;
    const col = idx % maxPerRow;
    const row = Math.floor(idx / maxPerRow);
    const x = startX + col * colGap;
    const y = startY + row * rowGap;
    const id = `ai-node-${idx}-${timestamp}`;

    const element = {
      id,
      type: 'rectangle',
      x,
      y,
      width: style.w,
      height: style.h,
      text: `${style.icon} ${node.label}`,
      strokeColor: style.stroke,
      fillColor: style.fill,
      strokeWidth: 2,
      diagramType: node.kind,
      status: 'existing',
    };

    nodeElements.push(element);
    elements.push(element);
  });

  // Create logical sequential connectors between tiers
  for (let i = 0; i < nodeElements.length - 1; i++) {
    const src = nodeElements[i];
    const dst = nodeElements[i + 1];
    elements.push({
      id: `ai-conn-${i}-${timestamp}`,
      type: 'connector',
      sourceId: src.id,
      targetId: dst.id,
      strokeColor: '#388bfd',
      strokeWidth: 2,
      text: i === 0 ? 'requests' : i === 1 ? 'routes' : 'persists',
      style: 'curved',
    });
  }

  return elements;
}

function summarizeElements(elements) {
  if (!elements || elements.length === 0) return 'No diagram nodes provided.';
  const nodes = elements.filter(e => e.type !== 'connector' && e.type !== 'stroke');
  const conns = elements.filter(e => e.type === 'connector');
  const nodeMap = new Map(nodes.map(n => [n.id, n.text || n.label || 'Node']));

  const nodeLines = nodes.map(n => `- ${n.text || n.label} (${n.diagramType || n.type})`).join('\n');
  const connLines = conns
    .map(c => `- ${nodeMap.get(c.sourceId) || c.sourceId} -> ${nodeMap.get(c.targetId) || c.targetId}${c.text ? ` [${c.text}]` : ''}`)
    .join('\n');

  return `Nodes:\n${nodeLines}\n\nConnections:\n${connLines}`;
}

function synthesizeCodeLocally(elements, prompt, language, codeType, summary) {
  const nodes = (elements || []).filter(e => e.type !== 'connector' && e.type !== 'stroke');
  const cleanNames = nodes.map(n => (n.text || n.label || 'service').replace(/[^\w\s]/g, '').trim());

  if (language === 'sql') {
    const tables = cleanNames.length > 0 ? cleanNames : ['users', 'products', 'orders', 'payments'];
    const sqlStatements = tables.map(name => {
      const tbl = name.toLowerCase().replace(/\s+/g, '_');
      return `CREATE TABLE IF NOT EXISTS ${tbl} (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;
    }).join('\n\n');

    return {
      language: 'sql',
      suggestedFilename: 'schema.sql',
      summary: 'Generated relational database schema corresponding to diagram entities.',
      code: `-- Generated SQL Database Schema from Whiteboard Diagram
-- Architecture: ${summary.slice(0, 100).replace(/\n/g, ' ')}

${sqlStatements}
`,
    };
  }

  if (language === 'python') {
    const services = cleanNames.length > 0 ? cleanNames : ['AuthService', 'OrderService', 'PaymentService'];
    const routes = services.map(s => {
      const slug = s.toLowerCase().replace(/\s+/g, '_');
      return `@app.get("/api/${slug}/health")
async def ${slug}_health():
    """Health check endpoint for ${s}"""
    return {"status": "ok", "service": "${s}", "timestamp": datetime.utcnow()}

@app.post("/api/${slug}/action")
async def ${slug}_execute(payload: dict):
    """Executes business operation for ${s}"""
    # TODO: Implement domain logic
    return {"success": True, "processed_by": "${s}"}
`;
    }).join('\n\n');

    return {
      language: 'python',
      suggestedFilename: 'main.py',
      summary: 'FastAPI microservices boilerplate generated from whiteboard nodes.',
      code: `"""
FastAPI Microservices Architecture
Generated from Whiteboard Architecture Diagram
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

app = FastAPI(title="CodeSync Architecture Service", version="1.0.0")

${routes}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`,
    };
  }

  // Default: TypeScript / Express
  const serviceList = cleanNames.length > 0 ? cleanNames : ['Auth', 'Payment', 'User', 'Order'];
  const routes = serviceList.map(s => {
    const slug = s.toLowerCase().replace(/\s+/g, '-');
    return `// ─── ${s} Routes ───
router.get('/${slug}/health', (req: Request, res: Response) => {
  res.json({ service: '${s}', status: 'healthy', uptime: process.uptime() });
});

router.post('/${slug}', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    // Process domain event for ${s}
    res.status(201).json({ success: true, service: '${s}', data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});`;
  }).join('\n\n');

  return {
    language: 'typescript',
    suggestedFilename: 'routes.ts',
    summary: 'TypeScript Express architecture router matching whiteboard services.',
    code: `import { Router, Request, Response } from 'express';

/**
 * Auto-generated Architecture Router from CodeSync Whiteboard
 * Synchronized with diagram elements:
 * ${serviceList.map(s => `* - ${s}`).join('\n ')}
 */
const router = Router();

${routes}

export default router;
`,
  };
}

export default {
  checkAiAccess,
  generateDiagramFromText,
  generateCodeFromDiagram,
};