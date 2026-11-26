import {
  PreviewEnvironment,
  PreviewAnnotation,
  ReviewMemo,
  User,
  WorkspaceMember,
} from '../models/index.js';
import universalPreviewService from '../services/universalPreviewService.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import { broadcastPreviewEvent } from '../sockets/workspaceSocket.js';

// ── Preview Environments Management ──

export const getPreviews = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const previews = await PreviewEnvironment.findAll({
    where: { workspaceId },
    include: [
      { model: User, as: 'creator', attributes: ['id', 'username', 'email'] },
      {
        model: PreviewAnnotation,
        as: 'annotations',
        include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({ success: true, previews });
});

export const createPreview = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { name, type, port, runtimeConfig, accessPolicy, resourceLimits } = req.body;

  const preview = await universalPreviewService.provisionPreview(workspaceId, req.user.id, {
    name,
    type,
    port,
    runtimeConfig,
    accessPolicy,
    resourceLimits,
  });

  const fullPreview = await PreviewEnvironment.findByPk(preview.id, {
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
  });

  broadcastPreviewEvent(workspaceId, 'preview:created', { preview: fullPreview });

  res.status(201).json({ success: true, preview: fullPreview });
});

export const getPreviewById = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const preview = await PreviewEnvironment.findByPk(previewId, {
    include: [
      { model: User, as: 'creator', attributes: ['id', 'username', 'email'] },
      {
        model: PreviewAnnotation,
        as: 'annotations',
        include: [
          { model: User, as: 'author', attributes: ['id', 'username'] },
          { model: User, as: 'assignee', attributes: ['id', 'username'] },
        ],
      },
    ],
  });

  if (!preview) {
    return res.status(404).json({ success: false, error: 'Preview environment not found' });
  }

  res.status(200).json({ success: true, preview });
});

export const terminatePreview = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const preview = await PreviewEnvironment.findByPk(previewId);
  if (!preview) {
    return res.status(404).json({ success: false, error: 'Preview environment not found' });
  }

  preview.status = 'terminated';
  await preview.save();

  broadcastPreviewEvent(preview.workspaceId, 'preview:terminated', { previewId });

  res.status(200).json({ success: true, message: 'Preview terminated successfully', previewId });
});

export const compareRevisions = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { baseRevision, targetRevision } = req.query;

  const comparison = await universalPreviewService.compareEnvironments(
    workspaceId,
    baseRevision || 'rev-base',
    targetRevision || 'rev-current'
  );

  res.status(200).json({ success: true, comparison });
});

export const getTestReport = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const report = await universalPreviewService.getAutomatedTestReport(previewId);
  res.status(200).json({ success: true, report });
});

export const createTestFile = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const { fileName, templateType, targetPort } = req.body;
  const preview = await PreviewEnvironment.findByPk(previewId);
  if (!preview) throw new Error('Preview environment not found');

  const result = await universalPreviewService.createManualTestFile(preview.workspaceId, {
    fileName,
    templateType,
    targetPort,
  });
  res.status(201).json({ success: true, ...result });
});

export const runTests = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const { testFile, targetPort } = req.body;

  const result = await universalPreviewService.runWorkspaceTests(previewId, {
    testFile,
    targetPort,
  });
  res.status(200).json({ success: true, ...result });
});

export const getTestFiles = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const preview = await PreviewEnvironment.findByPk(previewId);
  if (!preview) throw new Error('Preview environment not found');

  const files = await universalPreviewService.getWorkspaceTestFiles(preview.workspaceId);
  res.status(200).json({ success: true, files });
});

// ── Figma-Style Contextual Pins & Technical Annotations ──

export const getAnnotations = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const annotations = await PreviewAnnotation.findAll({
    where: { previewId },
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'assignee', attributes: ['id', 'username', 'email'] },
    ],
    order: [['createdAt', 'ASC']],
  });

  res.status(200).json({ success: true, annotations });
});

export const createAnnotation = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const {
    surface = 'web',
    type = 'bug',
    title,
    comment,
    coordinates,
    technicalContext,
    priority = 'medium',
    severity = 'medium',
    assignedTo,
  } = req.body;

  if (!title || !comment) {
    return res.status(400).json({ success: false, error: 'Title and comment are required' });
  }

  const preview = await PreviewEnvironment.findByPk(previewId);
  if (!preview) {
    return res.status(404).json({ success: false, error: 'Preview environment not found' });
  }

  const annotation = await PreviewAnnotation.create({
    previewId,
    workspaceId: preview.workspaceId,
    revisionId: preview.revisionId,
    surface,
    type,
    title: title.trim(),
    comment: comment.trim(),
    coordinates: coordinates || null,
    technicalContext: technicalContext || null,
    priority,
    severity,
    assignedTo: assignedTo || null,
    createdBy: req.user.id,
    replies: [],
  });

  const fullAnnotation = await PreviewAnnotation.findByPk(annotation.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'assignee', attributes: ['id', 'username', 'email'] },
    ],
  });

  broadcastPreviewEvent(preview.workspaceId, 'preview:annotation_created', {
    previewId,
    annotation: fullAnnotation,
  });

  res.status(201).json({ success: true, annotation: fullAnnotation });
});

export const updateAnnotation = asyncWrapper(async (req, res) => {
  const { annotationId } = req.params;
  const { status, priority, severity, assignedTo, decision, actionItem, comment } = req.body;

  const annotation = await PreviewAnnotation.findByPk(annotationId);
  if (!annotation) {
    return res.status(404).json({ success: false, error: 'Annotation not found' });
  }

  if (status !== undefined) annotation.status = status;
  if (priority !== undefined) annotation.priority = priority;
  if (severity !== undefined) annotation.severity = severity;
  if (assignedTo !== undefined) annotation.assignedTo = assignedTo;
  if (comment !== undefined) annotation.comment = comment;
  if (decision !== undefined) annotation.decision = decision;
  if (actionItem !== undefined) annotation.actionItem = actionItem;

  await annotation.save();

  const full = await PreviewAnnotation.findByPk(annotation.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'assignee', attributes: ['id', 'username', 'email'] },
    ],
  });

  broadcastPreviewEvent(annotation.workspaceId, 'preview:annotation_updated', {
    previewId: annotation.previewId,
    annotation: full,
  });

  res.status(200).json({ success: true, annotation: full });
});

export const addAnnotationReply = asyncWrapper(async (req, res) => {
  const { annotationId } = req.params;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ success: false, error: 'Reply comment is required' });
  }

  const annotation = await PreviewAnnotation.findByPk(annotationId);
  if (!annotation) {
    return res.status(404).json({ success: false, error: 'Annotation not found' });
  }

  const replies = Array.isArray(annotation.replies) ? [...annotation.replies] : [];
  const replyItem = {
    id: `rep-${Date.now().toString(36)}`,
    userId: req.user.id,
    username: req.user.username || 'Reviewer',
    comment: comment.trim(),
    createdAt: new Date().toISOString(),
  };

  replies.push(replyItem);
  annotation.replies = replies;
  await annotation.save();

  const full = await PreviewAnnotation.findByPk(annotation.id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'email'] },
      { model: User, as: 'assignee', attributes: ['id', 'username', 'email'] },
    ],
  });

  broadcastPreviewEvent(annotation.workspaceId, 'preview:annotation_reply', {
    previewId: annotation.previewId,
    annotationId: annotation.id,
    reply: replyItem,
  });

  res.status(200).json({ success: true, annotation: full, reply: replyItem });
});

// ── Structured Review Memo Management ──

export const getReviewMemo = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  let memo = await ReviewMemo.findOne({
    where: { previewId },
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
  });

  if (!memo) {
    const preview = await PreviewEnvironment.findByPk(previewId);
    if (!preview) return res.status(404).json({ success: false, error: 'Preview not found' });

    memo = await ReviewMemo.create({
      previewId,
      workspaceId: preview.workspaceId,
      revisionId: preview.revisionId,
      title: `Engineering Review Memo: ${preview.name}`,
      status: 'draft',
      summary: `Automated preview initialized for revision ${preview.revisionId}.`,
      createdBy: req.user.id,
      findingsSnapshot: [],
      decisions: [],
      actionItems: [],
      participants: [{ userId: req.user.id, username: req.user.username, role: 'author', attendedAt: new Date().toISOString() }],
    });
  }

  res.status(200).json({ success: true, memo });
});

export const updateReviewMemo = asyncWrapper(async (req, res) => {
  const { previewId } = req.params;
  const { title, objective, scope, status, summary, manualNotes, decisions, actionItems, conclusions } = req.body;

  let memo = await ReviewMemo.findOne({ where: { previewId } });
  if (!memo) {
    return res.status(404).json({ success: false, error: 'Memo not found' });
  }

  if (title !== undefined) memo.title = title;
  if (objective !== undefined) memo.objective = objective;
  if (scope !== undefined) memo.scope = scope;
  if (status !== undefined) memo.status = status;
  if (summary !== undefined) memo.summary = summary;
  if (manualNotes !== undefined) memo.manualNotes = manualNotes;
  if (decisions !== undefined) memo.decisions = decisions;
  if (actionItems !== undefined) memo.actionItems = actionItems;
  if (conclusions !== undefined) memo.conclusions = conclusions;

  if (status === 'approved' || status === 'rejected') {
    memo.finalizedAt = new Date();
  }

  await memo.save();

  broadcastPreviewEvent(memo.workspaceId, 'preview:memo_updated', { previewId, memo });

  res.status(200).json({ success: true, memo });
});

export const exportMemo = asyncWrapper(async (req, res) => {
  const { memoId } = req.params;
  const markdown = await universalPreviewService.exportMemoToMarkdown(memoId);
  res.status(200).json({ success: true, markdown });
});
