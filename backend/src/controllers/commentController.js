import { LineComment, User, WorkspaceMember } from '../models/index.js';
import asyncWrapper from '../utils/asyncWrapper.js';

export const getComments = asyncWrapper(async (req, res) => {
  const { id: workspaceId } = req.params;
  const { filePath } = req.query;

  const where = { workspaceId };
  if (filePath) {
    where.filePath = filePath;
  }

  // Get top-level comments and include replies
  const comments = await LineComment.findAll({
    where: { ...where, parentId: null },
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'email'] },
      {
        model: LineComment,
        as: 'replies',
        include: [{ model: User, as: 'author', attributes: ['id', 'username', 'email'] }],
      },
    ],
    order: [
      ['lineNumber', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });

  res.status(200).json({ success: true, comments });
});

export const createComment = asyncWrapper(async (req, res) => {
  const { id: workspaceId } = req.params;
  const { filePath, lineNumber, content, parentId } = req.body;

  if (!filePath || lineNumber === undefined || !content?.trim()) {
    return res.status(400).json({ success: false, error: 'filePath, lineNumber, and content are required' });
  }

  // Verify access permissions: viewer cannot comment
  const membership = req.membership || (await WorkspaceMember.findOne({
    where: { workspaceId, userId: req.user.id }
  }));

  if (membership) {
    const isViewerOnly =
      membership.role === 'viewer' ||
      (membership.studentAccess === 'viewer' || membership.studentAccess === 'view');
    const isElevated = ['owner', 'admin', 'teacher', 'team_leader', 'team_member'].includes(membership.role);

    if (isViewerOnly && !isElevated) {
      return res.status(403).json({ success: false, error: 'Viewer access cannot add comments. Commenter or Editor access required.' });
    }
  }

  const comment = await LineComment.create({
    workspaceId,
    filePath,
    lineNumber: Number(lineNumber),
    userId: req.user.id,
    content: content.trim(),
    parentId: parentId ? Number(parentId) : null,
  });

  const fullComment = await LineComment.findOne({
    where: { id: comment.id },
    include: [{ model: User, as: 'author', attributes: ['id', 'username', 'email'] }],
  });

  res.status(201).json({ success: true, comment: fullComment });
});

export const updateComment = asyncWrapper(async (req, res) => {
  const { commentId } = req.params;
  const { resolved, content } = req.body;

  const comment = await LineComment.findOne({
    where: { id: commentId },
    include: [{ model: User, as: 'author', attributes: ['id', 'username', 'email'] }],
  });

  if (!comment) {
    return res.status(404).json({ success: false, error: 'Comment not found' });
  }

  if (resolved !== undefined) {
    comment.resolved = Boolean(resolved);
  }
  if (content && comment.userId === req.user.id) {
    comment.content = content.trim();
  }

  await comment.save();

  res.status(200).json({ success: true, comment });
});

export const deleteComment = asyncWrapper(async (req, res) => {
  const { commentId } = req.params;

  const comment = await LineComment.findOne({ where: { id: commentId } });
  if (!comment) {
    return res.status(404).json({ success: false, error: 'Comment not found' });
  }

  const membership = req.membership || (await WorkspaceMember.findOne({
    where: { workspaceId: comment.workspaceId, userId: req.user.id }
  }));

  const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(membership?.role);
  if (comment.userId !== req.user.id && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Cannot delete another user\'s comment' });
  }

  // Delete replies if any
  await LineComment.destroy({ where: { parentId: comment.id } });
  await comment.destroy();

  res.status(200).json({ success: true, message: 'Comment deleted successfully' });
});
