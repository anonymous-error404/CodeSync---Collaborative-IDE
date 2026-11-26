/**
 * Client-side Operational Transform (OT) helpers for full-duplex concurrent editing.
 */

export interface TextOp {
  pos: number;
  deleteCount: number;
  insertText: string;
}

export function computeDelta(oldText = '', newText = ''): TextOp {
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

export function applyDelta(text = '', op: TextOp): string {
  if (!op || (op.deleteCount === 0 && !op.insertText)) return text;
  const pos = Math.max(0, Math.min(op.pos, text.length));
  const del = Math.max(0, Math.min(op.deleteCount || 0, text.length - pos));
  return text.slice(0, pos) + (op.insertText || '') + text.slice(pos + del);
}

export function transformOp(opA: TextOp, opB: TextOp, aWinsTie = false): TextOp {
  let pos = opA.pos;
  let del = opA.deleteCount || 0;
  const ins = opA.insertText || '';

  const bPos = opB.pos;
  const bDel = opB.deleteCount || 0;
  const bInsLen = (opB.insertText || '').length;
  const bEnd = bPos + bDel;

  if (bDel > 0) {
    if (pos >= bEnd) {
      pos -= bDel;
    } else if (pos + del <= bPos) {
      // strictly before
    } else if (pos >= bPos && pos + del <= bEnd) {
      del = 0;
      pos = bPos;
    } else if (pos < bPos && pos + del > bEnd) {
      del -= bDel;
    } else if (pos < bPos) {
      del = bPos - pos;
    } else {
      const overlap = bEnd - pos;
      del = Math.max(0, del - overlap);
      pos = bPos;
    }
  }

  if (bInsLen > 0) {
    if (pos > bPos || (pos === bPos && !aWinsTie)) {
      pos += bInsLen;
    }
  }

  return { pos, deleteCount: del, insertText: ins };
}

export function transformCursorByOp(cursorOffset: number, op: TextOp): number {
  const bPos = op.pos;
  const bDel = op.deleteCount || 0;
  const bInsLen = (op.insertText || '').length;

  let next = cursorOffset;
  if (bDel > 0) {
    if (next >= bPos + bDel) {
      next -= bDel;
    } else if (next > bPos) {
      next = bPos;
    }
  }
  if (bInsLen > 0 && next >= bPos) {
    next += bInsLen;
  }
  return Math.max(0, next);
}
