import whiteboardService from '../services/whiteboardService.js';
import diagramRecognitionService from '../services/diagramRecognitionService.js';
import nlpDiagramService from '../services/nlpDiagramService.js';
import { WorkspaceMember } from '../models/index.js';
import { roleRanks } from '../middleware/rbacMiddleware.js';

export async function generateFromPrompt(req, res, next) {
  try {
    const { prompt, mode } = req.body;
    const elements = nlpDiagramService.generateDiagramFromPrompt(prompt, mode);
    res.status(200).json({ success: true, elements });
  } catch (error) {
    next(error);
  }
}

export async function listWhiteboards(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const whiteboards = await whiteboardService.getWorkspaceWhiteboards(workspaceId);
    res.status(200).json({ success: true, whiteboards });
  } catch (error) {
    next(error);
  }
}

export async function getWhiteboard(req, res, next) {
  try {
    const { id } = req.params;
    const whiteboard = await whiteboardService.getWhiteboardById(id);
    if (!whiteboard) {
      return res.status(404).json({ success: false, error: 'Whiteboard not found' });
    }

    if (whiteboard.workspaceId && req.user?.id) {
      const membership = await WorkspaceMember.findOne({
        where: { workspaceId: whiteboard.workspaceId, userId: req.user.id }
      });
      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied: not a member of this workspace' });
      }
    }

    res.status(200).json({ success: true, whiteboard });
  } catch (error) {
    next(error);
  }
}

export async function createWhiteboard(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { title, mode, elements, viewport, metadata } = req.body;
    const createdBy = req.user?.id || req.user?.username || null;

    const whiteboard = await whiteboardService.createWhiteboard(workspaceId, {
      title,
      mode,
      elements,
      viewport,
      metadata,
      createdBy,
    });

    res.status(201).json({ success: true, whiteboard });
  } catch (error) {
    next(error);
  }
}

export async function updateWhiteboard(req, res, next) {
  try {
    const { id } = req.params;
    const { title, mode, elements, viewport, metadata, workspaceId } = req.body;

    const existing = await whiteboardService.getWhiteboardById(id);
    const targetWsId = existing?.workspaceId || workspaceId;

    if (targetWsId && req.user?.id) {
      const membership = await WorkspaceMember.findOne({
        where: { workspaceId: targetWsId, userId: req.user.id }
      });
      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied: not a member of this workspace' });
      }
      if (roleRanks[membership.role] < roleRanks.editor) {
        return res.status(403).json({ success: false, error: 'Access denied: viewers cannot edit whiteboards' });
      }
      if (membership.sessionRole === 'student' && membership.editorLocked) {
        return res.status(403).json({ success: false, error: 'Whiteboard editing is locked by the teacher' });
      }
    }

    const whiteboard = await whiteboardService.updateWhiteboard(id, {
      title,
      mode,
      elements,
      viewport,
      metadata,
    });

    if (!whiteboard) {
      return res.status(404).json({ success: false, error: 'Whiteboard not found' });
    }

    res.status(200).json({ success: true, whiteboard });
  } catch (error) {
    next(error);
  }
}

export async function deleteWhiteboard(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await whiteboardService.getWhiteboardById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Whiteboard not found' });
    }

    if (existing.workspaceId && req.user?.id) {
      const membership = await WorkspaceMember.findOne({
        where: { workspaceId: existing.workspaceId, userId: req.user.id }
      });
      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied: not a member of this workspace' });
      }
      if (roleRanks[membership.role] < roleRanks.editor) {
        return res.status(403).json({ success: false, error: 'Access denied: viewers cannot delete whiteboards' });
      }
    }

    const success = await whiteboardService.deleteWhiteboard(id);
    res.status(200).json({ success: true, message: 'Whiteboard deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function recognizeStroke(req, res, next) {
  try {
    const { points } = req.body;
    const candidate = diagramRecognitionService.recognizeStroke(points);
    res.status(200).json({ success: true, candidate });
  } catch (error) {
    next(error);
  }
}

export async function cleanLayout(req, res, next) {
  try {
    const { elements, algorithm, targetIds } = req.body;
    const laid = diagramRecognitionService.cleanLayout(elements, algorithm, targetIds);
    res.status(200).json({ success: true, elements: laid });
  } catch (error) {
    next(error);
  }
}

export async function generateTaskProposals(req, res, next) {
  try {
    const { elements } = req.body;
    const proposals = diagramRecognitionService.generateTaskProposals(elements);
    res.status(200).json({ success: true, proposals });
  } catch (error) {
    next(error);
  }
}
