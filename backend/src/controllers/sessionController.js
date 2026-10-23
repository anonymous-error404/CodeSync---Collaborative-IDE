import { TeachingSession, WorkspaceMember, User } from '../models/index.js';
import asyncWrapper from '../utils/asyncWrapper.js';

// ─── Session lifecycle ────────────────────────────────────────────────────────

/**
 * POST /workspaces/:id/session/start
 * Teacher starts a new teaching session for this workspace.
 * Assigns the caller's sessionRole to 'teacher', all other members become 'student'.
 * Requires: workspace member with role >= editor (enforced in route).
 */
export const startSession = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.id;
  const teacherUserId = req.user.id;

  // Find or reactivate existing session record for this workspace (due to workspaceId UNIQUE constraint)
  let session = await TeachingSession.findOne({ where: { workspaceId } });
  if (session) {
    session.active = true;
    session.teacherUserId = teacherUserId;
    session.focusMode = false;
    session.focusedFilePath = null;
    await session.save();
  } else {
    session = await TeachingSession.create({
      workspaceId,
      teacherUserId,
      active: true,
      focusMode: false,
      focusedFilePath: null,
    });
  }

  // Assign teacher role to caller, student role to all other members, reset locks
  await WorkspaceMember.update(
    { sessionRole: 'student', editorLocked: false, handRaised: false },
    { where: { workspaceId } }
  );
  await WorkspaceMember.update(
    { sessionRole: 'teacher', editorLocked: false, handRaised: false },
    { where: { workspaceId, userId: teacherUserId } }
  );

  res.status(201).json({ success: true, session });
});

/**
 * POST /workspaces/:id/session/end
 * Teacher ends the active session. Resets all sessionRoles to 'none'.
 * Requires: sessionRole === 'teacher'.
 */
export const endSession = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.id;

  const session = await TeachingSession.findOne({ where: { workspaceId, active: true } });
  if (!session) {
    return res.status(200).json({ success: true, message: 'No active session to end' });
  }

  session.active = false;
  await session.save();

  // Reset all sessionRoles
  await WorkspaceMember.update(
    { sessionRole: 'none', editorLocked: false, handRaised: false },
    { where: { workspaceId } }
  );

  res.status(200).json({ success: true, message: 'Session ended successfully' });
});

/**
 * GET /workspaces/:id/session
 * Get the current session state for a workspace.
 */
export const getSession = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.id;

  const session = await TeachingSession.findOne({
    where: { workspaceId, active: true },
    include: [{ model: User, as: 'teacher', attributes: ['id', 'username', 'email'] }],
  });

  if (!session) {
    return res.status(200).json({ success: true, session: null, active: false });
  }

  // Fetch all members with their session roles
  const members = await WorkspaceMember.findAll({
    where: { workspaceId },
    include: [{ model: User, attributes: ['id', 'username', 'email'] }],
  });

  res.status(200).json({
    success: true,
    active: true,
    session: {
      id: session.id,
      teacherUserId: session.teacherUserId,
      teacher: session.teacher,
      focusMode: session.focusMode,
      focusedFilePath: session.focusedFilePath,
      createdAt: session.createdAt,
    },
    members: members.map(m => ({
      userId: m.userId,
      username: m.User?.username,
      sessionRole: m.sessionRole,
      role: m.role,
      editorLocked: m.editorLocked,
      handRaised: m.handRaised,
    })),
  });
});

// ─── Student management ───────────────────────────────────────────────────────

/**
 * PATCH /workspaces/:id/session/members/:userId/role
 * Teacher reassigns a member's sessionRole (promote/demote between teacher/student/none).
 * Requires: sessionRole === 'teacher'.
 */
export const assignSessionRole = asyncWrapper(async (req, res) => {
  const { id: workspaceId, userId } = req.params;
  const { sessionRole } = req.body;

  if (!['teacher', 'student', 'none'].includes(sessionRole)) {
    return res.status(400).json({ success: false, error: "sessionRole must be 'teacher', 'student', or 'none'" });
  }

  // Prevent teacher from stripping their own role without appointing another teacher
  if (req.user.id.toString() === userId && sessionRole !== 'teacher') {
    const otherTeachers = await WorkspaceMember.count({
      where: { workspaceId, sessionRole: 'teacher', userId: { $ne: req.user.id } },
    });
    if (otherTeachers === 0) {
      return res.status(400).json({ success: false, error: 'Appoint another teacher before removing your own teacher role' });
    }
  }

  const member = await WorkspaceMember.findOne({ where: { workspaceId, userId } });
  if (!member) {
    return res.status(404).json({ success: false, error: 'Member not found' });
  }

  member.sessionRole = sessionRole;
  if (sessionRole === 'teacher') {
    member.editorLocked = false;
    member.handRaised = false;
  }
  await member.save();

  res.status(200).json({
    success: true,
    member: {
      userId: member.userId,
      sessionRole: member.sessionRole,
      editorLocked: member.editorLocked,
      handRaised: member.handRaised,
    },
  });
});

/**
 * PATCH /workspaces/:id/session/members/:userId/lock
 * Teacher locks or unlocks a student's editor.
 * Requires: sessionRole === 'teacher'.
 */
export const toggleStudentLock = asyncWrapper(async (req, res) => {
  const { id: workspaceId, userId } = req.params;
  const { locked } = req.body;

  const member = await WorkspaceMember.findOne({ where: { workspaceId, userId } });
  if (!member) {
    return res.status(404).json({ success: false, error: 'Member not found' });
  }

  member.editorLocked = Boolean(locked);
  await member.save();

  res.status(200).json({
    success: true,
    member: {
      userId: member.userId,
      editorLocked: member.editorLocked,
    },
  });
});

/**
 * POST /workspaces/:id/session/lock-all
 * Teacher locks all students' editors.
 * Requires: sessionRole === 'teacher'.
 */
export const lockAllStudents = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.id;

  await WorkspaceMember.update(
    { editorLocked: true },
    { where: { workspaceId, sessionRole: 'student' } }
  );

  res.status(200).json({ success: true, message: 'All student editors locked' });
});

/**
 * POST /workspaces/:id/session/unlock-all
 * Teacher unlocks all students' editors.
 * Requires: sessionRole === 'teacher'.
 */
export const unlockAllStudents = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.id;

  await WorkspaceMember.update(
    { editorLocked: false },
    { where: { workspaceId, sessionRole: 'student' } }
  );

  res.status(200).json({ success: true, message: 'All student editors unlocked' });
});

/**
 * PATCH /workspaces/:id/session/focus
 * Teacher toggles focus mode and optionally pins a file path to broadcast.
 * Requires: sessionRole === 'teacher'.
 */
export const setFocusMode = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.id;
  const { focusMode, focusedFilePath } = req.body;

  const session = await TeachingSession.findOne({ where: { workspaceId, active: true } });
  if (!session) {
    return res.status(404).json({ success: false, error: 'No active session found' });
  }

  session.focusMode = focusMode ?? session.focusMode;
  session.focusedFilePath = focusedFilePath ?? session.focusedFilePath;
  await session.save();

  res.status(200).json({ success: true, focusMode: session.focusMode, focusedFilePath: session.focusedFilePath });
});

/**
 * GET /workspaces/:id/session/my-role
 * Returns the requesting user's current session role.
 */
export const getMySessionRole = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.id;
  const userId = req.user.id;

  const member = await WorkspaceMember.findOne({ where: { workspaceId, userId } });
  if (!member) {
    return res.status(404).json({ success: false, error: 'Not a member of this workspace' });
  }

  const session = await TeachingSession.findOne({ where: { workspaceId, active: true } });

  res.status(200).json({
    success: true,
    sessionRole: member.sessionRole,
    editorLocked: member.editorLocked,
    handRaised: member.handRaised,
    sessionActive: !!session,
  });
});
