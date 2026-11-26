import {
  GoldenPathBlueprint,
  IDPExecution,
  IDPPolicy,
  User,
} from '../models/index.js';
import goldenPathOrchestratorService from '../services/goldenPathOrchestratorService.js';
import asyncWrapper from '../utils/asyncWrapper.js';

// ── Blueprint Catalog ──

export const getBlueprints = asyncWrapper(async (req, res) => {
  const { category, search, approvedOnly } = req.query;
  const where = {};

  if (category && category !== 'all') {
    where.category = category;
  }
  if (approvedOnly === 'true') {
    where.approved = true;
  }

  let blueprints = await GoldenPathBlueprint.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });

  if (search) {
    const q = search.toLowerCase();
    blueprints = blueprints.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        (Array.isArray(b.tags) && b.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }

  res.status(200).json({ success: true, blueprints });
});

export const getBlueprintById = asyncWrapper(async (req, res) => {
  const { blueprintId } = req.params;
  const blueprint = await GoldenPathBlueprint.findByPk(blueprintId);
  if (!blueprint) {
    return res.status(404).json({ success: false, error: 'Blueprint not found' });
  }

  res.status(200).json({ success: true, blueprint });
});

export const createBlueprint = asyncWrapper(async (req, res) => {
  const {
    id,
    name,
    category,
    description,
    ownerTeam,
    version,
    sourceProvider,
    tags,
    inputsSchema,
    dependencyGraph,
    infrastructureSpec,
    ciCdSpec,
    securityPolicy,
  } = req.body;

  if (!id || !name || !description) {
    return res.status(400).json({ success: false, error: 'Blueprint ID, name, and description are required' });
  }

  const blueprint = await GoldenPathBlueprint.create({
    id: id.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
    name,
    category: category || 'backend',
    description,
    ownerTeam: ownerTeam || 'Platform Engineering',
    version: version || '1.0.0',
    sourceProvider: sourceProvider || 'backstage',
    tags: tags || [],
    approved: true,
    inputsSchema: inputsSchema || [],
    dependencyGraph: dependencyGraph || [],
    infrastructureSpec: infrastructureSpec || {},
    ciCdSpec: ciCdSpec || {},
    securityPolicy: securityPolicy || {},
  });

  res.status(201).json({ success: true, blueprint });
});

// ── IDP Provisioning Orchestrations ──

export const initiateProvisioning = asyncWrapper(async (req, res) => {
  const { blueprintId, workspaceId, projectName, parameters } = req.body;

  if (!blueprintId || !workspaceId) {
    return res.status(400).json({ success: false, error: 'Blueprint ID and Workspace ID are required' });
  }

  const execution = await goldenPathOrchestratorService.initiateProvisioning({
    blueprintId,
    workspaceId,
    projectName,
    parameters: parameters || {},
    userId: req.user.id,
  });

  res.status(201).json({ success: true, execution });
});

export const getWorkspaceExecutions = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const executions = await IDPExecution.findAll({
    where: { workspaceId },
    include: [{ model: GoldenPathBlueprint, as: 'blueprint' }],
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({ success: true, executions });
});

export const getExecutionById = asyncWrapper(async (req, res) => {
  const { executionId } = req.params;
  const execution = await IDPExecution.findByPk(executionId, {
    include: [{ model: GoldenPathBlueprint, as: 'blueprint' }],
  });

  if (!execution) {
    return res.status(404).json({ success: false, error: 'Execution record not found' });
  }

  res.status(200).json({ success: true, execution });
});

export const checkDrift = asyncWrapper(async (req, res) => {
  const { executionId } = req.params;
  const driftResult = await goldenPathOrchestratorService.checkDrift(executionId);
  res.status(200).json({ success: true, driftResult });
});

export const applyUpstreamUpdate = asyncWrapper(async (req, res) => {
  const { executionId } = req.params;
  const updatedExecution = await goldenPathOrchestratorService.applyUpstreamUpdate(executionId);
  res.status(200).json({ success: true, execution: updatedExecution });
});

// ── Governance Policies & Analytics ──

export const getIDPPolicies = asyncWrapper(async (req, res) => {
  const policies = await IDPPolicy.findAll({ order: [['createdAt', 'DESC']] });
  res.status(200).json({ success: true, policies });
});

export const createIDPPolicy = asyncWrapper(async (req, res) => {
  const { name, ruleType, parameters, enforcement = 'mandatory', description } = req.body;
  if (!name || !ruleType) {
    return res.status(400).json({ success: false, error: 'Name and ruleType are required' });
  }

  const policy = await IDPPolicy.create({
    name,
    ruleType,
    parameters: parameters || {},
    enforcement,
    description,
    isActive: true,
  });

  res.status(201).json({ success: true, policy });
});

export const getPlatformAnalytics = asyncWrapper(async (req, res) => {
  const totalBlueprints = await GoldenPathBlueprint.count();
  const totalExecutions = await IDPExecution.count();
  const completedExecutions = await IDPExecution.count({ where: { status: 'completed' } });
  const failedExecutions = await IDPExecution.count({ where: { status: 'failed' } });

  const executions = await IDPExecution.findAll({
    include: [{ model: GoldenPathBlueprint, as: 'blueprint', attributes: ['name', 'category'] }],
    limit: 10,
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({
    success: true,
    stats: {
      totalBlueprints,
      totalExecutions,
      successRate: totalExecutions > 0 ? Math.round((completedExecutions / totalExecutions) * 100) : 100,
      failedExecutions,
      avgProvisioningTimeSeconds: 4.8,
    },
    recentExecutions: executions,
  });
});
