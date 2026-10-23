import Whiteboard from '../models/Whiteboard.js';

export async function getWorkspaceWhiteboards(workspaceId) {
  return await Whiteboard.findAll({
    where: { workspaceId },
    order: [['updatedAt', 'DESC']],
  });
}

export async function getWhiteboardById(id) {
  let whiteboard = null;
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
  if (isUuid) {
    whiteboard = await Whiteboard.findByPk(id);
  }
  if (!whiteboard) {
    whiteboard = await Whiteboard.findOne({
      where: { workspaceId: id },
      order: [['updatedAt', 'DESC']],
    });
  }
  return whiteboard;
}

export async function createWhiteboard(workspaceId, data = {}) {
  return await Whiteboard.create({
    workspaceId,
    title: data.title || 'Untitled Whiteboard',
    mode: data.mode || 'development',
    elements: data.elements || [],
    viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
    metadata: data.metadata || {},
    createdBy: data.createdBy || null,
  });
}

export async function updateWhiteboard(id, updates = {}) {
  let whiteboard = null;
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
  if (isUuid) {
    whiteboard = await Whiteboard.findByPk(id);
  }
  if (!whiteboard) {
    whiteboard = await Whiteboard.findOne({
      where: { workspaceId: id },
      order: [['updatedAt', 'DESC']],
    });
  }
  if (!whiteboard) {
    whiteboard = await Whiteboard.create({
      workspaceId: updates.workspaceId || id,
      title: updates.title || 'Untitled Whiteboard',
      mode: updates.mode || 'development',
      elements: updates.elements || [],
      viewport: updates.viewport || { x: 0, y: 0, zoom: 1 },
      metadata: updates.metadata || {},
    });
    return whiteboard;
  }

  if (updates.title !== undefined) whiteboard.title = updates.title;
  if (updates.mode !== undefined) whiteboard.mode = updates.mode;
  if (updates.elements !== undefined) whiteboard.elements = updates.elements;
  if (updates.viewport !== undefined) whiteboard.viewport = updates.viewport;
  if (updates.metadata !== undefined) whiteboard.metadata = updates.metadata;

  await whiteboard.save();
  return whiteboard;
}

export async function deleteWhiteboard(id) {
  const whiteboard = await Whiteboard.findByPk(id);
  if (!whiteboard) return false;
  await whiteboard.destroy();
  return true;
}

export default {
  getWorkspaceWhiteboards,
  getWhiteboardById,
  createWhiteboard,
  updateWhiteboard,
  deleteWhiteboard,
};
