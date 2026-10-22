import whiteboardService from '../services/whiteboardService.js';
import diagramRecognitionService from '../services/diagramRecognitionService.js';
import nlpDiagramService from '../services/nlpDiagramService.js';

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
    const { title, mode, elements, viewport, metadata } = req.body;

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
    const success = await whiteboardService.deleteWhiteboard(id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Whiteboard not found' });
    }
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
    const { elements } = req.body;
    const aligned = diagramRecognitionService.autoAlignLayout(elements);
    res.status(200).json({ success: true, elements: aligned });
  } catch (error) {
    next(error);
  }
}

export async function generateTaskProposals(req, res, next) {
  try {
    const { selectedElements } = req.body;
    if (!Array.isArray(selectedElements) || selectedElements.length === 0) {
      return res.status(400).json({ success: false, error: 'No elements selected' });
    }

    const tasks = selectedElements
      .filter(el => el.text || el.type === 'rectangle' || el.type === 'code_cell')
      .map((el, idx) => ({
        id: `task-prop-${idx}-${Date.now()}`,
        title: el.text ? `Implement ${el.text.slice(0, 40)}` : `Build Component ${idx + 1}`,
        description: `Task generated from whiteboard architecture object (${el.type}).\nLinked file path: ${el.linkedFilePath || 'None'}`,
        status: 'proposed',
        sourceElementId: el.id,
        acceptanceCriteria: [
          'Verify visual interface & integration contract',
          'Add unit tests for implementation logic',
        ],
      }));

    res.status(200).json({ success: true, tasks });
  } catch (error) {
    next(error);
  }
}

export default {
  listWhiteboards,
  getWhiteboard,
  createWhiteboard,
  updateWhiteboard,
  deleteWhiteboard,
  recognizeStroke,
  cleanLayout,
  generateTaskProposals,
};
