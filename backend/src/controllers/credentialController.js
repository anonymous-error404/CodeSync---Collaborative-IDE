import {
  CredentialProvider,
  EphemeralCredential,
  CredentialPolicy,
  CredentialAuditLog,
  User,
} from '../models/index.js';
import credentialBrokerService from '../services/credentialBrokerService.js';
import asyncWrapper from '../utils/asyncWrapper.js';

// ── Providers ──

export const getProviders = asyncWrapper(async (req, res) => {
  const providers = await CredentialProvider.findAll({
    order: [['createdAt', 'DESC']],
  });
  res.status(200).json({ success: true, providers });
});

export const createProvider = asyncWrapper(async (req, res) => {
  const { name, providerType, environment, config, rotationPolicy } = req.body;
  if (!name || !providerType) {
    return res.status(400).json({ success: false, error: 'Provider name and type are required' });
  }

  const provider = await CredentialProvider.create({
    name,
    providerType,
    environment: environment || 'development',
    config: config || {},
    rotationPolicy: rotationPolicy || { autoRotate: true, rotationIntervalDays: 30 },
    status: 'active',
    isHealthy: true,
    createdBy: req.user.id,
  });

  res.status(201).json({ success: true, provider });
});

export const toggleProvider = asyncWrapper(async (req, res) => {
  const { providerId } = req.params;
  const provider = await CredentialProvider.findByPk(providerId);
  if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });

  provider.status = provider.status === 'active' ? 'disabled' : 'active';
  await provider.save();

  res.status(200).json({ success: true, provider });
});

// ── Ephemeral Credentials & Token Exchange ──

export const getWorkspaceCredentials = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const credentials = await EphemeralCredential.findAll({
    where: { workspaceId },
    include: [
      { model: CredentialProvider, as: 'provider', attributes: ['id', 'name', 'providerType'] },
      { model: User, as: 'user', attributes: ['id', 'username', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({ success: true, credentials });
});

export const requestCredential = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const {
    serviceName = 'api',
    providerType = 'aws_iam',
    resourceTarget,
    environment = 'development',
    operations = ['read'],
    durationMinutes = 30,
    requestReason,
  } = req.body;

  if (!resourceTarget) {
    return res.status(400).json({ success: false, error: 'Resource target is required (e.g. s3:my-bucket)' });
  }

  const credential = await credentialBrokerService.requestEphemeralCredential({
    workspaceId,
    userId: req.user.id,
    userRole: req.membership?.role || 'developer',
    serviceName,
    providerType,
    resourceTarget,
    environment,
    operations,
    durationMinutes: Number(durationMinutes) || 30,
    requestReason,
    ipAddress: req.ip,
  });

  const full = await EphemeralCredential.findByPk(credential.id, {
    include: [{ model: CredentialProvider, as: 'provider' }],
  });

  res.status(201).json({ success: true, credential: full });
});

export const revokeCredential = asyncWrapper(async (req, res) => {
  const { credentialId } = req.params;
  const credential = await EphemeralCredential.findByPk(credentialId);
  if (!credential) return res.status(404).json({ success: false, error: 'Credential not found' });

  credential.status = 'revoked';
  await credential.save();

  await CredentialAuditLog.create({
    workspaceId: credential.workspaceId,
    userId: req.user.id,
    workloadIdentity: credential.workloadIdentity,
    providerType: 'broker',
    resourceTarget: credential.resourceTarget,
    operation: 'manual-revoke',
    environment: credential.environment,
    action: 'revoked',
    reason: `Revoked by user ${req.user.username} (#${req.user.id})`,
    ipAddress: req.ip,
  });

  res.status(200).json({ success: true, message: 'Credential revoked', credentialId });
});

// ── Security & Secret Scanning ──

export const scanSecrets = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const scanResult = await credentialBrokerService.scanWorkspaceForSecrets(workspaceId);
  res.status(200).json({ success: true, scanResult });
});

export const remediateSecret = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { filePath, lineNumber, envVarName } = req.body || {};
  const result = await credentialBrokerService.remediateSecret(workspaceId, {
    filePath,
    lineNumber,
    envVarName,
    userId: req.user?.id,
  });
  res.status(200).json(result);
});

// ── Policies ──

export const getPolicies = asyncWrapper(async (req, res) => {
  const policies = await CredentialPolicy.findAll({
    order: [['createdAt', 'DESC']],
  });
  res.status(200).json({ success: true, policies });
});

export const createPolicy = asyncWrapper(async (req, res) => {
  const {
    name,
    environment = 'all',
    role = 'all',
    workloadPattern = '*',
    allowedResources = ['*'],
    allowedOperations = ['read'],
    requiresApproval = false,
    maxTtlMinutes = 60,
    description,
  } = req.body;

  if (!name) return res.status(400).json({ success: false, error: 'Policy name is required' });

  const policy = await CredentialPolicy.create({
    name,
    environment,
    role,
    workloadPattern,
    allowedResources,
    allowedOperations,
    requiresApproval,
    maxTtlMinutes: Number(maxTtlMinutes) || 60,
    description,
    isActive: true,
  });

  res.status(201).json({ success: true, policy });
});

export const togglePolicy = asyncWrapper(async (req, res) => {
  const { policyId } = req.params;
  const policy = await CredentialPolicy.findByPk(policyId);
  if (!policy) return res.status(404).json({ success: false, error: 'Policy not found' });

  policy.isActive = !policy.isActive;
  await policy.save();

  res.status(200).json({ success: true, policy });
});

// ── Analytics & Emergency Lockdown ──

export const getAnalyticsAndAudit = asyncWrapper(async (req, res) => {
  const workspaceId = req.query.workspaceId;
  const where = workspaceId ? { workspaceId } : {};

  const logs = await CredentialAuditLog.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  const totalCredentials = await EphemeralCredential.count();
  const activeCredentials = await EphemeralCredential.count({ where: { status: 'active' } });
  const totalAuditEvents = await CredentialAuditLog.count();
  const blockedLeakedEvents = await CredentialAuditLog.count({ where: { action: 'leaked_blocked' } });
  const deniedEvents = await CredentialAuditLog.count({ where: { action: 'denied' } });

  res.status(200).json({
    success: true,
    stats: {
      totalCredentials,
      activeCredentials,
      totalAuditEvents,
      blockedLeakedEvents,
      deniedEvents,
    },
    logs,
  });
});

export const triggerEmergencyLockdown = asyncWrapper(async (req, res) => {
  const { targetType = 'workspace', targetId, reason } = req.body;

  const result = await credentialBrokerService.emergencyRevocation({
    targetType,
    targetId,
    reason,
    initiatedBy: req.user.id,
  });

  res.status(200).json({ success: true, result });
});
