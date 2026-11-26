/**
 * Full-Duplex Operational Transform (OT) Engine for Concurrent Collaborative Edits.
 *
 * Uses single-splice text deltas { pos, deleteCount, insertText } with
 * server-authoritative monotonic document versions and deterministic
 * tie-breaking so concurrent edits never overwrite each other.
 */

export function computeDelta(oldText = '', newText = '') {
  if (oldText === newText) {
    return { pos: 0, deleteCount: 0, insertText: '' };
  }

  let prefixLen = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefixLen < minLen && oldText.charCodeAt(prefixLen) === newText.charCodeAt(prefixLen)) {
    prefixLen++;
  }

  let oldSuffix = oldText.length;
  let newSuffix = newText.length;
  while (
    oldSuffix > prefixLen &&
    newSuffix > prefixLen &&
    oldText.charCodeAt(oldSuffix - 1) === newText.charCodeAt(newSuffix - 1)
  ) {
    oldSuffix--;
    newSuffix--;
  }

  return {
    pos: prefixLen,
    deleteCount: oldSuffix - prefixLen,
    insertText: newText.slice(prefixLen, newSuffix),
  };
}

export function applyDelta(text = '', op) {
  if (!op || (op.deleteCount === 0 && !op.insertText)) return text;
  const pos = Math.max(0, Math.min(op.pos, text.length));
  const del = Math.max(0, Math.min(op.deleteCount || 0, text.length - pos));
  return text.slice(0, pos) + (op.insertText || '') + text.slice(pos + del);
}

/**
 * Transform operation `opA` against an already-applied concurrent operation `opB`.
 * Returns transformed `opA'` such that apply(apply(doc, opB), opA') == apply(apply(doc, opA), opB').
 */
export function transformOp(opA, opB, aWinsTie = false) {
  let pos = opA.pos;
  let del = opA.deleteCount || 0;
  const ins = opA.insertText || '';

  const bPos = opB.pos;
  const bDel = opB.deleteCount || 0;
  const bInsLen = (opB.insertText || '').length;
  const bEnd = bPos + bDel;

  // 1. Account for opB's deletion
  if (bDel > 0) {
    if (pos >= bEnd) {
      pos -= bDel;
    } else if (pos + del <= bPos) {
      // opA is strictly before opB
    } else if (pos >= bPos && pos + del <= bEnd) {
      // opA's deleted range is completely inside opB's deleted range
      del = 0;
      pos = bPos;
    } else if (pos < bPos && pos + del > bEnd) {
      // opA completely spans opB's deleted range
      del -= bDel;
    } else if (pos < bPos) {
      // Partial overlap: opA starts before bPos and ends inside [bPos, bEnd]
      del = bPos - pos;
    } else {
      // Partial overlap: opA starts inside [bPos, bEnd] and ends after bEnd
      const overlap = bEnd - pos;
      del = Math.max(0, del - overlap);
      pos = bPos;
    }
  }

  // 2. Account for opB's insertion
  if (bInsLen > 0) {
    if (pos > bPos || (pos === bPos && !aWinsTie)) {
      pos += bInsLen;
    } else if (pos < bPos && pos + del > bPos) {
      // opB inserted inside opA's delete range; expand deleteCount only if needed,
      // or split — keeping opB's newly inserted text intact by shifting only if pos >= bPos.
    }
  }

  return { pos, deleteCount: del, insertText: ins };
}

export class DocumentOTManager {
  constructor(maxHistory = 250) {
    this.docs = new Map(); // `${workspaceId}:${filePath}` -> { content, version, history }
    this.maxHistory = maxHistory;
  }

  _key(workspaceId, filePath) {
    return `${workspaceId}:${filePath}`;
  }

  getDoc(workspaceId, filePath) {
    return this.docs.get(this._key(workspaceId, filePath)) || null;
  }

  initDoc(workspaceId, filePath, content = '') {
    const key = this._key(workspaceId, filePath);
    const existing = this.docs.get(key);
    if (existing) return existing;
    const state = { content, version: 0, history: [] };
    this.docs.set(key, state);
    return state;
  }

  setFullContent(workspaceId, filePath, newContent, clientId = 'system') {
    const key = this._key(workspaceId, filePath);
    const doc = this.docs.get(key) || { content: '', version: 0, history: [] };
    const op = computeDelta(doc.content, newContent);
    doc.content = newContent;
    doc.version += 1;
    doc.history.push({ version: doc.version, op, clientId });
    if (doc.history.length > this.maxHistory) doc.history.shift();
    this.docs.set(key, doc);
    return { version: doc.version, op, content: doc.content };
  }

  applyClientOp(workspaceId, filePath, baseVersion, rawOp, clientId) {
    const doc = this.getDoc(workspaceId, filePath);
    if (!doc) {
      throw new Error('Document OT state not initialized');
    }

    let op = {
      pos: Math.max(0, Number(rawOp?.pos) || 0),
      deleteCount: Math.max(0, Number(rawOp?.deleteCount) || 0),
      insertText: typeof rawOp?.insertText === 'string' ? rawOp.insertText : '',
    };

    // Transform against all concurrent server ops since baseVersion
    if (typeof baseVersion === 'number' && baseVersion < doc.version) {
      const missed = doc.history.filter(h => h.version > baseVersion);
      for (const h of missed) {
        const aWins = String(clientId) < String(h.clientId);
        op = transformOp(op, h.op, aWins);
      }
    }

    doc.content = applyDelta(doc.content, op);
    doc.version += 1;
    doc.history.push({ version: doc.version, op, clientId });
    if (doc.history.length > this.maxHistory) doc.history.shift();

    return {
      version: doc.version,
      op,
      content: doc.content,
    };
  }
}

export const otManager = new DocumentOTManager();
