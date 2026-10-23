import { ProjectTask, CodeReview, User, WorkspaceMember } from '../models/index.js';
import asyncWrapper from '../utils/asyncWrapper.js';

// ─── TASKS MANAGEMENT ────────────────────────────────────────────────────────

export const getTasks = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const tasks = await ProjectTask.findAll({
    where: { workspaceId },
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'creator', attributes: ['id', 'username', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({ success: true, tasks });
});

export const createTask = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { title, description, priority, assignedTo, filePath } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  // If assignedTo is provided, ensure user is a workspace member
  if (assignedTo) {
    const isMember = await WorkspaceMember.findOne({
      where: { workspaceId, userId: assignedTo },
    });
    if (!isMember) {
      return res.status(400).json({ success: false, error: 'Assigned user is not a member of this workspace' });
    }
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const taskPriority = validPriorities.includes(priority) ? priority : 'medium';

  const task = await ProjectTask.create({
    workspaceId,
    title: title.trim(),
    description: description ? description.trim() : null,
    priority: taskPriority,
    status: 'todo',
    assignedTo: assignedTo || null,
    createdBy: req.user.id,
    filePath: filePath || null,
  });

  const fullTask = await ProjectTask.findByPk(task.id, {
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'creator', attributes: ['id', 'username', 'email'] },
    ],
  });

  res.status(201).json({ success: true, task: fullTask });
});

export const updateTask = asyncWrapper(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, status, priority, assignedTo, filePath } = req.body;

  const task = await ProjectTask.findByPk(taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }

  const validStatuses = ['todo', 'in_progress', 'in_review', 'done'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid task status' });
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ success: false, error: 'Invalid task priority' });
  }

  if (assignedTo !== undefined) {
    if (assignedTo !== null) {
      const isMember = await WorkspaceMember.findOne({
        where: { workspaceId: task.workspaceId, userId: assignedTo },
      });
      if (!isMember) {
        return res.status(400).json({ success: false, error: 'Assigned user is not a member of this workspace' });
      }
      task.assignedTo = assignedTo;
    } else {
      task.assignedTo = null;
    }
  }

  if (title !== undefined) task.title = title.trim();
  if (description !== undefined) task.description = description ? description.trim() : null;
  if (status !== undefined) task.status = status;
  if (priority !== undefined) task.priority = priority;
  if (filePath !== undefined) task.filePath = filePath || null;

  await task.save();

  const updatedTask = await ProjectTask.findByPk(task.id, {
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'creator', attributes: ['id', 'username', 'email'] },
    ],
  });

  res.status(200).json({ success: true, task: updatedTask });
});

export const deleteTask = asyncWrapper(async (req, res) => {
  const { taskId } = req.params;

  const task = await ProjectTask.findByPk(taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }

  const actorRole = req.membership?.role || 'viewer';
  const isLeader = ['team_leader', 'owner', 'admin'].includes(actorRole);
  const isCreator = task.createdBy === req.user.id;

  if (!isLeader && !isCreator) {
    return res.status(403).json({ success: false, error: 'Only a team leader or task creator can delete this task' });
  }

  await task.destroy();

  res.status(200).json({ success: true, message: 'Task deleted successfully', taskId: Number(taskId) });
});

// ─── CODE REVIEWS / PR MANAGEMENT ──────────────────────────────────────────

export const getReviews = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const reviews = await CodeReview.findAll({
    where: { workspaceId },
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'reviewer', attributes: ['id', 'username', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({ success: true, reviews });
});

export const createReview = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { title, description, filePath } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Review title is required' });
  }
  if (!filePath || !filePath.trim()) {
    return res.status(400).json({ success: false, error: 'File path is required for code review' });
  }

  const review = await CodeReview.create({
    workspaceId,
    title: title.trim(),
    description: description ? description.trim() : null,
    filePath: filePath.trim(),
    status: 'open',
    authorId: req.user.id,
  });

  const fullReview = await CodeReview.findByPk(review.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'reviewer', attributes: ['id', 'username', 'email'] },
    ],
  });

  res.status(201).json({ success: true, review: fullReview });
});

export const updateReviewStatus = asyncWrapper(async (req, res) => {
  const { reviewId } = req.params;
  const { status, reviewNote } = req.body;

  const validStatuses = ['open', 'approved', 'changes_requested', 'closed'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid review status. Must be open, approved, changes_requested, or closed' });
  }

  const review = await CodeReview.findByPk(reviewId);
  if (!review) {
    return res.status(404).json({ success: false, error: 'Code review not found' });
  }

  const actorRole = req.membership?.role || 'viewer';
  const isLeader = ['team_leader', 'owner', 'admin'].includes(actorRole);

  // If approving or requesting changes, require team leader / admin / owner role
  if (['approved', 'changes_requested'].includes(status) && !isLeader) {
    return res.status(403).json({ success: false, error: 'Only a team leader can approve or request changes on code reviews' });
  }

  review.status = status;
  review.reviewerId = req.user.id;
  if (reviewNote !== undefined) {
    review.reviewNote = reviewNote;
  }

  await review.save();

  const updatedReview = await CodeReview.findByPk(review.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'reviewer', attributes: ['id', 'username', 'email'] },
    ],
  });

  res.status(200).json({ success: true, review: updatedReview });
});

export const deleteReview = asyncWrapper(async (req, res) => {
  const { reviewId } = req.params;

  const review = await CodeReview.findByPk(reviewId);
  if (!review) {
    return res.status(404).json({ success: false, error: 'Code review not found' });
  }

  const actorRole = req.membership?.role || 'viewer';
  const isLeader = ['team_leader', 'owner', 'admin'].includes(actorRole);
  const isAuthor = review.authorId === req.user.id;

  if (!isLeader && !isAuthor) {
    return res.status(403).json({ success: false, error: 'Only a team leader or the author can remove this review request' });
  }

  await review.destroy();

  res.status(200).json({ success: true, message: 'Review deleted successfully', reviewId: Number(reviewId) });
});
