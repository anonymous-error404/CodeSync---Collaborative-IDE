/**
 * NLP Diagram Service — Deterministic implementation.
 *
 * All LLM and generative AI code removed.
 * Text-to-diagram parsing is now fully client-side (see textToDiagramParser.ts).
 *
 * This module retains the entity-classification helper for backward compatibility
 * with any server-side step-diagram generation that uses it.
 */

const ENTITY_PATTERNS = [
  { keywords: ['db', 'database', 'sql', 'postgres', 'mongo', 'sqlite', 'store', 'repository'], label: 'Database',      icon: '🛢️', color: '#d29922' },
  { keywords: ['cache', 'redis', 'memcached'],                                                 label: 'Cache',          icon: '⚡',  color: '#f0883e' },
  { keywords: ['auth', 'jwt', 'oauth', 'login', 'security'],                                  label: 'Auth Service',   icon: '🔑',  color: '#3fb950' },
  { keywords: ['gateway', 'proxy', 'router', 'nginx', 'ingress'],                             label: 'Gateway',        icon: '🌐',  color: '#2f81f7' },
  { keywords: ['queue', 'kafka', 'rabbitmq', 'pubsub', 'message'],                            label: 'Message Queue',  icon: '📨',  color: '#a371f7' },
  { keywords: ['client', 'frontend', 'react', 'app', 'user', 'web', 'ui'],                   label: 'Client / UI',    icon: '💻',  color: '#58a6ff' },
  { keywords: ['payment', 'stripe', 'billing'],                                               label: 'Payment Gateway',icon: '💳',  color: '#db61a2' },
];

function classifyEntity(phrase) {
  const lower = phrase.toLowerCase();
  for (const pattern of ENTITY_PATTERNS) {
    if (pattern.keywords.some(k => lower.includes(k))) return pattern;
  }
  return { label: 'Service', icon: '⚙️', color: '#2f81f7' };
}

/**
 * Deterministic step-diagram generation from explicit phrase list.
 * Used when the client submits a pre-tokenised list.
 *
 * AI/LLM completion code removed.
 * Teach mode removed.
 */
export function generateDiagramFromPrompt(prompt, _mode = 'development') {
  if (!prompt || !prompt.trim()) return [];

  const timestamp = Date.now();

  // Split on explicit relationship markers and sentence boundaries
  const rawPhrases = prompt
    .replace(/(-->|->|=>|connects to|calls|sends to|queries|then)/gi, ' | ')
    .split(/\||\n|\./)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (rawPhrases.length === 0) return [];

  const nodes = [];
  const startX = 100, startY = 180;
  const nodeWidth = 170, nodeHeight = 80;
  const gapX = 70, gapY = 110;
  const maxPerRow = 4;

  rawPhrases.forEach((phrase, idx) => {
    const entity = classifyEntity(phrase);
    const row = Math.floor(idx / maxPerRow);
    const col = idx % maxPerRow;
    const x = startX + col * (nodeWidth + gapX);
    const y = startY + row * (nodeHeight + gapY);
    const nodeId = `node-${idx}-${timestamp}`;

    const cleanLabel = phrase.charAt(0).toUpperCase() + phrase.slice(1);

    nodes.push({
      id: nodeId,
      type: 'rectangle',
      x, y,
      width: nodeWidth,
      height: nodeHeight,
      text: `${entity.icon} ${cleanLabel}`,
      fillColor: '#161b22',
      strokeColor: entity.color,
      strokeWidth: 2,
      diagramType: 'generic',
      status: idx === 0 ? 'existing' : 'proposed',
    });

    // Connector from previous node
    if (idx > 0) {
      const prevCol = (idx - 1) % maxPerRow;
      const prevRow = Math.floor((idx - 1) / maxPerRow);
      const prevX = startX + prevCol * (nodeWidth + gapX) + nodeWidth;
      const prevY = startY + prevRow * (nodeHeight + gapY) + nodeHeight / 2;
      const targetX = prevRow === row ? x : x + nodeWidth / 2;
      const targetY = prevRow === row ? y + nodeHeight / 2 : y;

      nodes.push({
        id: `arrow-${idx}-${timestamp}`,
        type: 'connector',
        x: prevX,
        y: prevY,
        // Use raw points for backward compat — canvas handles sourceId/targetId for new nodes
        points: [{ x: prevX, y: prevY }, { x: targetX, y: targetY }],
        sourceId: `node-${idx - 1}-${timestamp}`,
        targetId: nodeId,
        relationship: 'calls',
        strokeColor: '#7d8590',
        strokeWidth: 2,
      });
    }
  });

  return nodes;
}

export default { generateDiagramFromPrompt };
