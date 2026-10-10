import { useEffect, useState } from 'react';

export interface RemoteCursorData {
  socketId: string;
  username: string;
  filePath: string;
  cursor: {
    line: number;
    col: number;
    start?: number;
    end?: number;
    isTyping?: boolean;
  };
  color: string;
  lastActive: number;
}

export interface LocalCursorData {
  line: number;
  col: number;
  username: string;
  color?: string;
}

interface Props {
  cursors: RemoteCursorData[];
  localCursor?: LocalCursorData | null;
  scrollTop: number;
  scrollLeft: number;
}

export function RemoteCursorsOverlay({
  cursors,
  localCursor,
  scrollTop,
  scrollLeft,
}: Props) {
  const [, setTick] = useState(0);
  const [charWidth, setCharWidth] = useState(8.42);
  const [lineHeight, setLineHeight] = useState(23.8); // 14px * 1.7

  // Accurately measure character width and line height in the user's browser
  useEffect(() => {
    const span = document.createElement('span');
    span.style.fontFamily = 'var(--font-mono)';
    span.style.fontSize = '14px';
    span.style.lineHeight = '1.7';
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.textContent = 'MMMMMMMMMM'; // 10 chars for better precision
    document.body.appendChild(span);
    const rect = span.getBoundingClientRect();
    if (rect.width > 0) {
      setCharWidth(rect.width / 10);
    }
    if (rect.height > 0) {
      setLineHeight(rect.height);
    }
    document.body.removeChild(span);
  }, []);

  // Re-render every second to smoothly fade typing indicators
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = Date.now();
  const paddingTop = 16;  // py-4 = 1rem = 16px
  const paddingLeft = 12; // px-3 = 0.75rem = 12px

  // Keep active remote cursors
  const activeCursors = cursors.filter(c => (now - c.lastActive) < 60000);

  // Determine local cursor coordinates
  const localLine = localCursor ? Math.max(0, localCursor.line) : null;
  const localCol = localCursor ? Math.max(0, localCursor.col) : null;
  const localColor = localCursor?.color || '#2f81f7';

  // Check which remote cursors overlap with the local cursor
  const isRemoteOverlappingWithLocal = (c: RemoteCursorData) => {
    if (localLine === null || localCol === null) return false;
    const rLine = Math.max(0, c.cursor.line ?? 0);
    const rCol = Math.max(0, c.cursor.col ?? 0);
    return rLine === localLine && Math.abs(rCol - localCol) <= 1;
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none z-10 overflow-hidden"
      style={{ left: 52 }} // 52px offsets the line numbers column
    >
      {/* ── 1. Local User Cursor ("You") ── */}
      {localCursor && localLine !== null && localCol !== null && (() => {
        const top = paddingTop + (localLine * lineHeight) - scrollTop;
        const left = paddingLeft + (localCol * charWidth) - scrollLeft;

        if (top < -60 || top > 2500) return null;

        return (
          <div
            key="local-user-cursor"
            className="absolute pointer-events-none transition-all duration-75"
            style={{
              top,
              left,
              willChange: 'top, left',
              zIndex: 35,
            }}
          >
            {/* Top pip/flag for the local cursor */}
            <div
              className="absolute -top-1 left-0 w-2 h-1 rounded-sm"
              style={{
                background: localColor,
                boxShadow: `0 0 6px ${localColor}`,
              }}
            />

            {/* Local cursor caret bar */}
            <div
              className="w-0.5 rounded-full"
              style={{
                height: Math.round(lineHeight * 0.88),
                background: localColor,
                boxShadow: `0 0 6px ${localColor}aa`,
              }}
            />

            {/* Local user badge: ALWAYS anchored securely above the caret */}
            <div
              className="absolute left-0 -top-6 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shadow-md whitespace-nowrap"
              style={{
                background: localColor,
                lineHeight: 1.2,
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              }}
            >
              <span>You ({localCursor.username})</span>
              {/* Downward pointer triangle pointing to local caret */}
              <div
                className="absolute left-1 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4"
                style={{ borderTopColor: localColor }}
              />
            </div>
          </div>
        );
      })()}

      {/* ── 2. Remote Collaborator Cursors ── */}
      {activeCursors.map((c, index) => {
        const line = Math.max(0, c.cursor.line ?? 0);
        const col = Math.max(0, c.cursor.col ?? 0);
        const baseTop = paddingTop + (line * lineHeight) - scrollTop;
        const baseLeft = paddingLeft + (col * charWidth) - scrollLeft;
        const isRecentlyActive = (now - c.lastActive) < 3500;
        const isTyping = isRecentlyActive && Boolean(c.cursor.isTyping);

        // Don't render if scrolled outside viewport
        if (baseTop < -60 || baseTop > 2500) return null;

        // Check if this remote cursor overlaps with local cursor
        const overlapsWithLocal = isRemoteOverlappingWithLocal(c);

        // Count how many prior remote cursors also overlap at this exact same spot
        const priorOverlaps = activeCursors.slice(0, index).filter(other => {
          const oLine = Math.max(0, other.cursor.line ?? 0);
          const oCol = Math.max(0, other.cursor.col ?? 0);
          return oLine === line && Math.abs(oCol - col) <= 1;
        });
        const overlapOrder = priorOverlaps.length;

        // Calculate horizontal caret offset to ensure 100% separate visibility when at the same spot
        // Local takes offset 0. Remote 0 takes +4px if overlapping with local, or 0px if local is not there.
        const horizontalOffset = overlapsWithLocal
          ? (overlapOrder + 1) * 5
          : overlapOrder * 5;

        // Badge placement:
        // If overlapping with local: Local is above, so remote badges sit BELOW the caret with an upward arrow.
        // If not overlapping with local, but overlapping with another remote: 1st remote is above, subsequent are below.
        // Otherwise: Remote badge sits cleanly ABOVE the caret.
        const isBelow = overlapsWithLocal || overlapOrder > 0;
        const verticalBadgeOffset = isBelow
          ? Math.round(lineHeight * 0.9) + 4 + (overlapOrder > 0 && overlapsWithLocal ? (overlapOrder * 18) : 0)
          : -24;

        return (
          <div
            key={c.socketId}
            className="absolute transition-all duration-75 pointer-events-none"
            style={{
              top: baseTop,
              left: baseLeft + horizontalOffset,
              willChange: 'top, left',
              zIndex: 30 - index,
            }}
          >
            {/* Top pip/flag for remote cursor */}
            <div
              className="absolute -top-1 left-0 w-2 h-1 rounded-sm"
              style={{
                background: c.color,
                boxShadow: `0 0 6px ${c.color}`,
              }}
            />

            {/* Colored vertical blinking cursor bar */}
            <div
              className="w-0.5 rounded-full animate-pulse"
              style={{
                height: Math.round(lineHeight * 0.88),
                background: c.color,
                boxShadow: `0 0 8px ${c.color}`,
              }}
            />

            {/* Floating remote user badge with typing indicator */}
            <div
              className="absolute left-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shadow-lg whitespace-nowrap"
              style={{
                top: verticalBadgeOffset,
                background: c.color,
                lineHeight: 1.2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              {/* Pointer triangle connecting badge to its caret */}
              {isBelow ? (
                // Upward arrow when badge is below caret
                <div
                  className="absolute left-1 -top-1 w-0 h-0 border-x-4 border-x-transparent border-b-4"
                  style={{ borderBottomColor: c.color }}
                />
              ) : (
                // Downward arrow when badge is above caret
                <div
                  className="absolute left-1 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4"
                  style={{ borderTopColor: c.color }}
                />
              )}

              {isTyping && (
                <span className="flex items-center gap-0.5 mr-0.5">
                  <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
              <span>{c.username}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
