/**
 * Whiteboard REST API client.
 *
 * All operations that were previously reliant on LLM/AI endpoints have been
 * replaced with local deterministic implementations.
 * This file only makes real network calls for persistence (CRUD) and
 * stroke recognition (pure geometric, server-side).
 */

import type { WhiteboardData, CanvasElement, TaskProposal } from '../types/whiteboard';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('codesync_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Board CRUD ───────────────────────────────────────────────────────────────

export async function fetchWhiteboards(workspaceId: string): Promise<WhiteboardData[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/whiteboards`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return data.success ? data.whiteboards : [];
  } catch {
    return [];
  }
}

export async function fetchWhiteboard(id: string): Promise<WhiteboardData | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/whiteboards/${id}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return data.success ? data.whiteboard : null;
  } catch {
    return null;
  }
}

export async function createWhiteboard(
  workspaceId: string,
  payload: Partial<WhiteboardData>,
): Promise<WhiteboardData | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/whiteboards`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.success ? data.whiteboard : null;
  } catch {
    return null;
  }
}

export async function updateWhiteboard(
  id: string,
  payload: Partial<WhiteboardData>,
): Promise<WhiteboardData | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/whiteboards/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.success ? data.whiteboard : null;
  } catch {
    return null;
  }
}

export async function deleteWhiteboard(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/whiteboards/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

// ─── Geometric stroke recognition (deterministic, server-side) ───────────────

/**
 * Sends stroke points to the backend for geometric shape recognition.
 * The server uses a purely algorithmic approach (bounding box, straightness,
 * aspect ratio). No LLM or AI service involved.
 */
export async function recognizeStroke(
  points: Array<{ x: number; y: number }>,
): Promise<Partial<CanvasElement> | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/whiteboards/recognize-stroke`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ points }),
    });
    const data = await res.json();
    return data.success ? data.candidate : null;
  } catch {
    return null;
  }
}

// ─── Task proposals (template-based, no AI) ───────────────────────────────────

/**
 * Generate task proposals from selected elements using template-based rules.
 * Falls back to a local computation if the server is unavailable.
 */
export async function generateTaskProposals(
  selectedElements: CanvasElement[],
): Promise<TaskProposal[]> {
  // Local fallback (always available)
  const local = buildLocalTaskProposals(selectedElements);

  try {
    const res = await fetch(`${BASE_URL}/api/whiteboards/generate-tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ selectedElements }),
    });
    const data = await res.json();
    return data.success && data.tasks.length > 0 ? data.tasks : local;
  } catch {
    return local;
  }
}

function buildLocalTaskProposals(elements: CanvasElement[]): TaskProposal[] {
  return elements
    .filter(el => el.type !== 'stroke' && el.type !== 'connector' && el.type !== 'arrow')
    .slice(0, 10) // reasonable limit
    .map((el, idx) => {
      const label = el.text || el.diagramType || el.type;
      return {
        id: `task-local-${idx}-${Date.now()}`,
        title: `Implement ${label.slice(0, 60)}`,
        description: `Engineering task derived from whiteboard node: ${label}${el.linkedFilePath ? `\nLinked file: ${el.linkedFilePath}` : ''}`,
        status: 'proposed' as const,
        sourceElementId: el.id,
        priority: el.status === 'proposed' ? 'high' : 'medium',
        linkedFilePath: el.linkedFilePath,
        acceptanceCriteria: [
          `${label} behaves according to the design on the whiteboard`,
          'Unit tests cover core logic',
          ...(el.linkedFilePath ? [`Changes verified against ${el.linkedFilePath}`] : []),
        ],
      };
    });
}

export default {
  fetchWhiteboards,
  fetchWhiteboard,
  createWhiteboard,
  updateWhiteboard,
  deleteWhiteboard,
  recognizeStroke,
  generateTaskProposals,
};
