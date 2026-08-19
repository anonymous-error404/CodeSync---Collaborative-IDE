import { useRef, useEffect, useCallback } from 'react';

// ── Bracket / quote pairs ────────────────────────────────────────────────────
const PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
};
const CLOSING_CHARS = new Set(Object.values(PAIRS));
const OPENER_CHARS  = new Set(Object.keys(PAIRS));

// ── Indentation ──────────────────────────────────────────────────────────────
const INDENT = '  '; // 2 spaces

/** True if the trimmed line ends with ':' after a Python block keyword. */
function isPythonColonTrigger(line: string): boolean {
  const t = line.trim();
  return (
    t.endsWith(':') &&
    /^(if|elif|else|for|while|def|class|try|except|finally|with|async\s+def|async\s+for|async\s+with)\b/.test(t)
  );
}

/** Extract file extension (lower-case). */
function getExt(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

/** Extract the leading whitespace of a string. */
function leadingWS(line: string): string {
  return /^(\s*)/.exec(line)?.[1] ?? '';
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

export function useCodeEditor(
  value: string,
  onChange: (v: string) => void,
  filename: string,
  onSave?: () => void,
) {
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  // Stores the cursor position we want to apply AFTER React re-renders.
  const pendingCursor = useRef<{ start: number; end: number } | null>(null);

  // After every render: apply the pending cursor if one was queued.
  useEffect(() => {
    if (pendingCursor.current && textareaRef.current) {
      const { start, end } = pendingCursor.current;
      textareaRef.current.setSelectionRange(start, end);
      pendingCursor.current = null;
    }
  });

  const setCursor = (start: number, end = start) => {
    pendingCursor.current = { start, end };
  };

  /** Apply a value change and schedule cursor placement. */
  const applyChange = (newValue: string, cursorStart: number, cursorEnd = cursorStart) => {
    onChange(newValue);
    setCursor(cursorStart, cursorEnd);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const ss = textarea.selectionStart;
      const se = textarea.selectionEnd;
      const key = e.key;

      // ── Ctrl/Cmd + S → save ───────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // ── Smart skip: closing char already present ──────────────────────────
      // e.g. cursor before ')' and user types ')' → just move right
      if (CLOSING_CHARS.has(key) && ss === se && value[ss] === key) {
        e.preventDefault();
        setCursor(ss + 1);
        return;
      }

      // ── Smart Backspace: inside empty pair ────────────────────────────────
      // e.g. `(|)` → Backspace → both deleted
      if (key === 'Backspace' && ss === se && ss > 0) {
        const before = value[ss - 1];
        const after  = value[ss];
        if (OPENER_CHARS.has(before) && PAIRS[before] === after) {
          e.preventDefault();
          applyChange(value.slice(0, ss - 1) + value.slice(ss + 1), ss - 1);
          return;
        }
      }

      // ── Auto-close opening bracket / quote ───────────────────────────────
      if (OPENER_CHARS.has(key)) {
        e.preventDefault();
        const closing = PAIRS[key];

        if (ss !== se) {
          // Wrap the selection: (selected) | "selected" | [selected]
          const selected = value.slice(ss, se);
          applyChange(
            value.slice(0, ss) + key + selected + closing + value.slice(se),
            ss + 1,
            se + 1,
          );
        } else {
          // Insert pair, cursor between them
          applyChange(value.slice(0, ss) + key + closing + value.slice(se), ss + 1);
        }
        return;
      }

      // ── Tab / Shift+Tab ──────────────────────────────────────────────────
      if (key === 'Tab') {
        e.preventDefault();

        if (e.shiftKey) {
          // Remove up to 2 spaces (or 1) from start of current line
          const lineStart = value.lastIndexOf('\n', ss - 1) + 1;
          const lineEnd   = value.indexOf('\n', ss);
          const eol       = lineEnd === -1 ? value.length : lineEnd;
          const line      = value.slice(lineStart, eol);

          const remove = line.startsWith('    ') ? 4
            : line.startsWith('  ') ? 2
            : line.startsWith(' ')  ? 1
            : 0;

          if (remove > 0) {
            const newV = value.slice(0, lineStart) + line.slice(remove) + value.slice(eol);
            applyChange(newV, Math.max(lineStart, ss - remove));
          }
        } else {
          // Insert 2 spaces
          applyChange(value.slice(0, ss) + INDENT + value.slice(se), ss + INDENT.length);
        }
        return;
      }

      // ── Enter: smart indentation ─────────────────────────────────────────
      if (key === 'Enter') {
        e.preventDefault();

        const isPython = getExt(filename) === 'py';

        // Find start of current line
        const lineStart   = value.lastIndexOf('\n', ss - 1) + 1;
        const currentLine = value.slice(lineStart, ss);
        const baseIndent  = leadingWS(currentLine);
        const trimmed     = currentLine.trimEnd();
        const lastChar    = trimmed.slice(-1);
        const nextChar    = value[se]; // char immediately after cursor/selection

        const isBlockOpener =
          ['(', '[', '{'].includes(lastChar) ||
          (isPython && isPythonColonTrigger(trimmed));

        const isNextCloser =
          nextChar !== undefined && [')', ']', '}'].includes(nextChar);

        if (isBlockOpener && isNextCloser) {
          // Cursor is between opener and closer: `{|}` or `(|)`
          // → Split into 3 lines:  {\n  cursor\n}
          const insertion = '\n' + baseIndent + INDENT + '\n' + baseIndent;
          const newV = value.slice(0, ss) + insertion + value.slice(se);
          applyChange(newV, ss + 1 + baseIndent.length + INDENT.length);
        } else if (isBlockOpener) {
          // Line ends with block opener → add extra indent level
          const insertion = '\n' + baseIndent + INDENT;
          applyChange(value.slice(0, ss) + insertion + value.slice(se), ss + insertion.length);
        } else {
          // Normal Enter: preserve current indentation
          const insertion = '\n' + baseIndent;
          applyChange(value.slice(0, ss) + insertion + value.slice(se), ss + insertion.length);
        }
        return;
      }
    },
    [value, onChange, filename, onSave],
  );

  return { textareaRef, handleKeyDown };
}
