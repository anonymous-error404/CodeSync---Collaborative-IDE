import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  CredentialProvider,
  EphemeralCredential,
  CredentialPolicy,
  CredentialAuditLog,
  User,
} from '../models/index.js';
import storageService from './storageService.js';

class CredentialBrokerService {
  constructor() {
    // Comprehensive high-precision secret patterns covering major cloud & SaaS platforms
    this.secretSignatures = [
      // Cloud Infrastructure
      {
        name: 'AWS Access Key ID',
        vendor: 'AWS',
        severity: 'critical',
        confidence: 'verified',
        regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
        remediation: 'Immediately revoke in AWS IAM Console. Delegate credentials through CodeSync IAM STS Token Broker.',
      },
      {
        name: 'AWS Secret Access Key',
        vendor: 'AWS',
        severity: 'critical',
        confidence: 'verified',
        regex: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
        remediation: 'Never hardcode AWS secret access keys. Rotate immediately and use IAM instance roles or ephemeral tokens.',
      },
      {
        name: 'Google Cloud API Key',
        vendor: 'GCP',
        severity: 'high',
        confidence: 'verified',
        regex: /AIza[0-9A-Za-z\-_]{35}/g,
        remediation: 'Restrict key in Google Cloud Console to specific APIs and authorized HTTP/IP referrers, or use Service Account keys.',
      },
      {
        name: 'GCP Service Account Key',
        vendor: 'GCP',
        severity: 'critical',
        confidence: 'verified',
        regex: /"type":\s*"service_account"[\s\S]*?"private_key":\s*"-----BEGIN PRIVATE KEY/g,
        remediation: 'Service Account private keys must never be committed to repository files. Store in Cloud Secret Manager or Vault.',
      },

      // Version Control & AI
      {
        name: 'GitHub Personal Access Token',
        vendor: 'GitHub',
        severity: 'critical',
        confidence: 'verified',
        regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
        remediation: 'Revoke compromised token on github.com/settings/tokens. Utilize GitHub App credentials or fine-grained tokens.',
      },
      {
        name: 'GitHub Fine-Grained Token',
        vendor: 'GitHub',
        severity: 'critical',
        confidence: 'verified',
        regex: /github_pat_[A-Za-z0-9_]{82}/g,
        remediation: 'Revoke compromised token on github.com/settings/tokens immediately.',
      },
      {
        name: 'OpenAI API Key',
        vendor: 'OpenAI',
        severity: 'critical',
        confidence: 'verified',
        regex: /sk-(?:proj-)?[a-zA-Z0-9_-]{48,128}/g,
        remediation: 'Revoke key in platform.openai.com/api-keys. Route LLM requests through backend proxy with environment variable injection.',
      },
      {
        name: 'Anthropic Claude API Key',
        vendor: 'Anthropic',
        severity: 'critical',
        confidence: 'verified',
        regex: /sk-ant-[a-zA-Z0-9_-]{80,128}/g,
        remediation: 'Revoke key in console.anthropic.com. Rotate immediately to prevent unauthorized usage charges.',
      },

      // Financial & Commerce
      {
        name: 'Stripe Secret Key',
        vendor: 'Stripe',
        severity: 'critical',
        confidence: 'verified',
        regex: /sk_(?:live|test)_[0-9a-zA-Z]{24,99}/g,
        remediation: 'Roll API key on Stripe Dashboard under Developers > API Keys. Move to Stripe Sandbox Test Broker.',
      },
      {
        name: 'Stripe Restricted API Key',
        vendor: 'Stripe',
        severity: 'high',
        confidence: 'verified',
        regex: /rk_(?:live|test)_[0-9a-zA-Z]{24,99}/g,
        remediation: 'Revoke restricted key in Stripe Dashboard and verify account audit trail.',
      },
      {
        name: 'Stripe Webhook Secret',
        vendor: 'Stripe',
        severity: 'high',
        confidence: 'verified',
        regex: /whsec_[0-9a-zA-Z]{32,64}/g,
        remediation: 'Rotate webhook signing secret in Stripe Dashboard to prevent webhook forgery attacks.',
      },

      // Database Connection Strings
      {
        name: 'PostgreSQL Database Credentials in URI',
        vendor: 'Database',
        severity: 'critical',
        confidence: 'verified',
        regex: /postgres(?:ql)?:\/\/[^:\s'"]+:([^@\s'"]+)@[^\/\s'"]+\/[^\s'"]+/gi,
        remediation: 'Extract database password from connection URI. Inject via CodeSync Dynamic DB Secret Broker.',
      },
      {
        name: 'MySQL Database Credentials in URI',
        vendor: 'Database',
        severity: 'critical',
        confidence: 'verified',
        regex: /mysql:\/\/[^:\s'"]+:([^@\s'"]+)@[^\/\s'"]+\/[^\s'"]+/gi,
        remediation: 'Remove plaintext credentials from database connection string.',
      },
      {
        name: 'MongoDB Connection String with Password',
        vendor: 'Database',
        severity: 'critical',
        confidence: 'verified',
        regex: /mongodb(?:\+srv)?:\/\/[^:\s'"]+:([^@\s'"]+)@[^\/\s'"]+/gi,
        remediation: 'Remove embedded credentials from MongoDB Atlas connection string and rotate the database user password.',
      },
      {
        name: 'Redis Connection String with Password',
        vendor: 'Database',
        severity: 'high',
        confidence: 'verified',
        regex: /redis:\/\/:([^@\s'"]+)@[^\/\s'"]+/gi,
        remediation: 'Move Redis AUTH token to environment variable or dynamic secrets broker.',
      },

      // Messaging & Notifications
      {
        name: 'Slack Bot / User Token',
        vendor: 'Slack',
        severity: 'high',
        confidence: 'verified',
        regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}/g,
        remediation: 'Revoke bot or user token in Slack API dashboard under OAuth & Permissions.',
      },
      {
        name: 'Slack Incoming Webhook',
        vendor: 'Slack',
        severity: 'medium',
        confidence: 'verified',
        regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8,12}\/B[0-9A-Z]{8,12}\/[0-9A-Za-z]{24}/g,
        remediation: 'Regenerate Slack webhook URL in your app management console.',
      },
      {
        name: 'Discord Bot Token',
        vendor: 'Discord',
        severity: 'high',
        confidence: 'verified',
        regex: /[MN][A-Za-z\d]{23,25}\.[\w-]{6}\.[\w-]{27}/g,
        remediation: 'Reset bot token in Discord Developer Portal > Bot > Reset Token.',
      },
      {
        name: 'SendGrid API Key',
        vendor: 'SendGrid',
        severity: 'high',
        confidence: 'verified',
        regex: /SG\.[a-zA-Z0-9_\-\.]{66,}/g,
        remediation: 'Delete API key in SendGrid Settings > API Keys and generate a replacement with least privilege.',
      },
      {
        name: 'Twilio Auth Token',
        vendor: 'Twilio',
        severity: 'high',
        confidence: 'verified',
        regex: /(?:twilio[_\s-]*(?:auth|token|secret))\s*[:=]\s*['"]?([a-f0-9]{32})['"]?/gi,
        remediation: 'Request secondary Auth Token in Twilio Console and promote to primary after rotation.',
      },

      // Cryptographic Material & Tokens
      {
        name: 'Asymmetric Private Key (RSA, EC, OpenSSH)',
        vendor: 'Crypto',
        severity: 'critical',
        confidence: 'verified',
        regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
        remediation: 'Remove private key file immediately from git history. Generate new public-private keypair.',
      },
      {
        name: 'Hardcoded JWT Auth Token',
        vendor: 'Auth',
        severity: 'medium',
        confidence: 'probable',
        regex: /eyJ[A-Za-z0-9-_=]{10,}\.eyJ[A-Za-z0-9-_=]{10,}\.[A-Za-z0-9-_.+/=]{10,}/g,
        remediation: 'Never hardcode JWT bearer tokens in source code. Obtain dynamically via authentication handshake.',
      },
      {
        name: 'High-Entropy Secret / API Password',
        vendor: 'Generic',
        severity: 'high',
        confidence: 'probable',
        regex: /(?:api_key|apikey|secret_key|app_secret|password|passwd|auth_token)\s*[:=]\s*['"]([A-Za-z0-9/+=_~.-]{16,80})['"]/gi,
        remediation: 'Extract credential into CodeSync Ephemeral Credential Broker.',
      },
    ];
  }

  /**
   * Calculate Shannon Entropy to measure cryptographic randomness of a candidate secret
   */
  calculateEntropy(str) {
    if (!str || str.length === 0) return 0;
    const len = str.length;
    const frequencies = {};
    for (let i = 0; i < len; i++) {
      const char = str[i];
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }
    return Math.round(entropy * 100) / 100;
  }

  /**
   * Check if a candidate string is an obvious false-positive dummy / placeholder
   */
  isFalsePositive(str) {
    if (!str || str.length < 8) return true;
    const lower = str.toLowerCase();
    const blacklist = [
      'your_api_key', 'my_secret_key', 'example', 'placeholder', 'changeme',
      'password123', 'admin123', 'test_key', 'dummy_token', 'xxxxxxxx',
      '00000000', '12345678', 'qwertyuiop', 'insert_here', 'todo'
    ];
    return blacklist.some(term => lower.includes(term));
  }

  /**
   * Issue a SPIFFE Workload Identity for a workspace and service
   */
  generateWorkloadIdentity(workspaceId, serviceName = 'default') {
    return `spiffe://codesync.internal/ns/${workspaceId}/sa/${serviceName}`;
  }

  /**
   * Dynamic Token Exchange: evaluate ABAC/RBAC policies and issue ephemeral credential
   */
  async requestEphemeralCredential({
    workspaceId,
    userId,
    userRole = 'developer',
    serviceName = 'api',
    providerType = 'aws_iam',
    resourceTarget,
    environment = 'development',
    operations = ['read'],
    durationMinutes = 30,
    requestReason = 'Workspace local debugging & test',
    ipAddress = '127.0.0.1',
  }) {
    const workloadId = this.generateWorkloadIdentity(workspaceId, serviceName);

    // 1. Fetch matching active policies for this environment & workload
    const policies = await CredentialPolicy.findAll({
      where: { isActive: true },
    });

    let policyAllowed = false;
    let maxAllowedTtl = 60;
    let matchedPolicy = null;

    for (const policy of policies) {
      if (policy.environment !== 'all' && policy.environment !== environment) continue;
      if (policy.role !== 'all' && policy.role !== userRole) continue;

      // Check operations
      const opAllowed = operations.every((op) => policy.allowedOperations.includes(op) || policy.allowedOperations.includes('*'));
      if (!opAllowed) continue;

      // Check resource target pattern
      const resourceAllowed = policy.allowedResources.some((pattern) => {
        if (pattern === '*') return true;
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
        return regex.test(resourceTarget);
      });

      if (resourceAllowed) {
        policyAllowed = true;
        maxAllowedTtl = policy.maxTtlMinutes;
        matchedPolicy = policy;
        break;
      }
    }

    // 2. Reject if no policy permits access
    if (!policyAllowed) {
      await CredentialAuditLog.create({
        workspaceId,
        userId,
        workloadIdentity: workloadId,
        providerType,
        resourceTarget,
        operation: operations.join(','),
        environment,
        action: 'denied',
        reason: `Policy check failed: no active rule authorizes role ${userRole} to perform [${operations.join(',')}] on target '${resourceTarget}' in '${environment}' environment.`,
        ipAddress,
      });

      throw new Error(`Credential Access Denied: Unauthorized request for ${resourceTarget} under ${environment} policy.`);
    }

    // 3. Check if approval is required (e.g. production break-glass)
    if (matchedPolicy?.requiresApproval) {
      await CredentialAuditLog.create({
        workspaceId,
        userId,
        workloadIdentity: workloadId,
        providerType,
        resourceTarget,
        operation: operations.join(','),
        environment,
        action: 'denied',
        reason: `Access requires explicit Team Leader / Security Officer approval before issuance.`,
        ipAddress,
      });

      throw new Error(`Access Pending Approval: Production resource '${resourceTarget}' requires elevation authorization.`);
    }

    // 4. Generate scoped short-lived credential
    const ttl = Math.min(durationMinutes, maxAllowedTtl);
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);
    const secretEntropy = crypto.randomBytes(18).toString('hex');
    const maskedToken = `cs_eph_${providerType.slice(0, 3)}_${secretEntropy.slice(0, 4)}...${secretEntropy.slice(-4)}`;

    // Find provider or fallback
    const provider = await CredentialProvider.findOne({
      where: { providerType, environment },
    });

    const ephemeralCred = await EphemeralCredential.create({
      providerId: provider ? provider.id : null,
      workspaceId,
      workloadIdentity: workloadId,
      resourceTarget,
      environment,
      permissions: operations,
      maskedToken,
      rawSecretRef: `secret-ref-${secretEntropy}`,
      status: 'active',
      requestReason,
      expiresAt,
      issuedToUser: userId,
    });

    // 5. Audit Log Entry
    await CredentialAuditLog.create({
      workspaceId,
      userId,
      workloadIdentity: workloadId,
      providerType,
      resourceTarget,
      operation: operations.join(','),
      environment,
      action: 'allowed',
      reason: `Authorized by policy '${matchedPolicy?.name || 'Default Sandbox'}' with TTL ${ttl}m.`,
      ipAddress,
      metadata: { credentialId: ephemeralCred.id, expiresAt },
    });

    return ephemeralCred;
  }

  /**
   * Secret Scanning Engine: Deep high-entropy heuristic analysis and signature detection across workspace files
   */
  async scanWorkspaceForSecrets(workspaceId) {
    const workspaceDir = storageService.getWorkspacePath(workspaceId);
    const findings = [];
    let totalFilesScanned = 0;
    let scannedBytes = 0;
    const startTime = Date.now();

    if (!fs.existsSync(workspaceDir)) {
      return {
        workspaceId,
        scannedAt: new Date().toISOString(),
        totalFilesScanned: 0,
        scannedBytes: 0,
        scanDurationMs: 0,
        findings: [],
        clean: true,
      };
    }

    const scanDirRecursive = (currentDir, relDir = '') => {
      let items;
      try {
        items = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const item of items) {
        if (
          item.name === 'node_modules' ||
          item.name === '.git' ||
          item.name === 'dist' ||
          item.name === 'build' ||
          item.name === '.next' ||
          item.name === 'coverage'
        ) {
          continue;
        }

        const fullPath = path.join(currentDir, item.name);
        const relPath = path.join(relDir, item.name).replace(/\\/g, '/');

        if (item.isDirectory()) {
          scanDirRecursive(fullPath, relPath);
        } else if (item.isFile()) {
          totalFilesScanned++;

          let stat;
          try {
            stat = fs.statSync(fullPath);
            scannedBytes += stat.size;
          } catch {
            continue;
          }

          // Skip excessively large minified bundles or binaries (> 2MB)
          if (stat.size > 2 * 1024 * 1024) continue;

          // 1. Dangerous environment files with unencrypted values
          if (item.name === '.env' || item.name.endsWith('.env.local') || item.name.endsWith('.env.production')) {
            findings.push({
              id: `sec-${findings.length + 1}`,
              file: relPath,
              line: 1,
              secretType: 'Unvaulted Environment Secret File',
              vendor: 'Environment',
              severity: 'critical',
              confidence: 'verified',
              entropy: 4.2,
              preview: 'Plaintext environment configuration file present in repository directory.',
              remediation: 'Remove .env from version control. Inject secrets dynamically at runtime through CodeSync Credential Vault.',
            });
          }

          // 2. Scan file contents
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, lineIdx) => {
              if (line.length > 1500) return; // Skip minified single-line files

              for (const sig of this.secretSignatures) {
                sig.regex.lastIndex = 0;
                let match;

                while ((match = sig.regex.exec(line)) !== null) {
                  const candidate = match[1] || match[0];

                  // Skip common false positives
                  if (this.isFalsePositive(candidate)) continue;

                  const entropy = this.calculateEntropy(candidate);

                  // Mask secret for secure display
                  let masked = line.trim();
                  if (candidate.length > 8) {
                    const keepChars = Math.min(4, Math.floor(candidate.length / 4));
                    const maskedToken = candidate.slice(0, keepChars) + '••••••••' + candidate.slice(-keepChars);
                    masked = masked.replace(candidate, maskedToken);
                  } else {
                    masked = masked.replace(candidate, '••••••••');
                  }

                  findings.push({
                    id: `sec-${findings.length + 1}`,
                    file: relPath,
                    line: lineIdx + 1,
                    secretType: sig.name,
                    vendor: sig.vendor,
                    severity: sig.severity,
                    confidence: sig.confidence,
                    entropy,
                    preview: masked.slice(0, 120),
                    remediation: sig.remediation,
                  });

                  // Only report once per signature per line
                  break;
                }
              }
            });
          } catch {
            // Ignore binary read errors
          }
        }
      }
    };

    scanDirRecursive(workspaceDir);

    const scanDurationMs = Date.now() - startTime;

    if (findings.length > 0) {
      await CredentialAuditLog.create({
        workspaceId,
        workloadIdentity: `vault://workspace/${workspaceId}/scanner`,
        providerType: 'scanner',
        resourceTarget: 'workspace-filesystem',
        operation: 'security-scan',
        environment: 'development',
        action: 'leaked_blocked',
        reason: `Detected ${findings.length} unencrypted secret occurrences across ${totalFilesScanned} workspace files.`,
      });
    }

    return {
      workspaceId,
      scannedAt: new Date().toISOString(),
      totalFilesScanned,
      scannedBytes,
      scanDurationMs,
      criticalCount: findings.filter(f => f.severity === 'critical').length,
      highCount: findings.filter(f => f.severity === 'high').length,
      mediumCount: findings.filter(f => f.severity === 'medium').length,
      findings,
      clean: findings.length === 0,
    };
  }

  /**
   * Retrieve active, non-expired ephemeral credentials as environment variables for runtime injection
   */
  async getActiveWorkspaceEnvVars(workspaceId) {
    const envVars = {};
    try {
      const now = new Date();
      const activeCreds = await EphemeralCredential.findAll({
        where: { workspaceId, status: 'active' },
      });

      for (const cred of activeCreds) {
        if (cred.expiresAt && new Date(cred.expiresAt) <= now) {
          await cred.update({ status: 'expired' });
          continue;
        }
        const safeName = (cred.serviceName || 'SECRET')
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const key = safeName.startsWith('CODESYNC_') ? safeName : `CODESYNC_${safeName}_TOKEN`;
        envVars[key] = cred.tokenPreview || `vault-ephemeral-${cred.id}`;
      }
    } catch {
      // Fail open to empty env map if DB is unavailable
    }
    return envVars;
  }

  /**
   * Remediate a detected hardcoded secret by replacing it with an environment variable reference
   * and registering an ephemeral credential entry in the vault.
   */
  async remediateSecret(workspaceId, { filePath, lineNumber, envVarName, userId }) {
    if (!filePath || !lineNumber) {
      throw new Error('filePath and lineNumber are required to remediate a secret');
    }

    const safePath = path.resolve(storageService.getWorkspacePath(workspaceId), filePath);
    const rootPath = storageService.getWorkspacePath(workspaceId);
    if (!safePath.startsWith(rootPath) || !fs.existsSync(safePath)) {
      throw new Error('Target file not found inside workspace boundary');
    }

    const content = fs.readFileSync(safePath, 'utf8');
    const lines = content.split('\n');
    const idx = Number(lineNumber) - 1;
    if (idx < 0 || idx >= lines.length) {
      throw new Error('Invalid lineNumber for target file');
    }

    const targetLine = lines[idx];
    let matchedSig = null;
    let matchedSecret = null;

    for (const sig of this.secretSignatures) {
      sig.regex.lastIndex = 0;
      const m = sig.regex.exec(targetLine);
      if (m) {
        matchedSig = sig;
        matchedSecret = m[1] || m[0];
        break;
      }
    }

    if (!matchedSecret) {
      throw new Error('No matching secret pattern found on the specified line');
    }

    const cleanEnvName = (envVarName || `${matchedSig.vendor}_SECRET_KEY`)
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');

    const isPython = filePath.endsWith('.py');
    const replacementExpr = isPython
      ? `os.environ.get("${cleanEnvName}", "")`
      : `process.env.${cleanEnvName}`;

    // Replace quoted or unquoted secret occurrence with env var lookup
    const escapedSecret = matchedSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quotedRx = new RegExp(`(['"\`])${escapedSecret}\\1`);
    if (quotedRx.test(targetLine)) {
      lines[idx] = targetLine.replace(quotedRx, replacementExpr);
    } else {
      lines[idx] = targetLine.replace(matchedSecret, replacementExpr);
    }

    fs.writeFileSync(safePath, lines.join('\n'), 'utf8');

    // Register an ephemeral vault record for auditability & runtime injection
    const rawToken = `vault_ref_${crypto.randomBytes(12).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    await EphemeralCredential.create({
      workspaceId,
      issuedToUser: userId || null,
      workloadIdentity: `vault://workspace/${workspaceId}/remediated/${cleanEnvName}`,
      providerType: matchedSig.vendor.toLowerCase(),
      serviceName: cleanEnvName,
      resourceTarget: `${filePath}:${lineNumber}`,
      scope: 'read:env',
      tokenHash,
      tokenPreview: `${rawToken.slice(0, 10)}...${rawToken.slice(-4)}`,
      expiresAt,
      status: 'active',
    });

    await CredentialAuditLog.create({
      workspaceId,
      userId: userId || null,
      workloadIdentity: `vault://workspace/${workspaceId}/scanner`,
      providerType: matchedSig.vendor.toLowerCase(),
      resourceTarget: `${filePath}:${lineNumber}`,
      operation: 'secret-remediation',
      environment: 'development',
      action: 'remediated',
      reason: `Replaced hardcoded ${matchedSig.name} with ${replacementExpr} and vaulted ephemeral reference.`,
    });

    return {
      success: true,
      filePath,
      lineNumber,
      envVarName: cleanEnvName,
      replacement: replacementExpr,
    };
  }

  /**
   * Terminal & Output Redaction Filter: scrubs secret keys from stdout/stderr
   */
  redactOutput(text) {
    if (!text || typeof text !== 'string') return text;
    let sanitized = text;
    for (const sig of this.secretSignatures) {
      sig.regex.lastIndex = 0;
      sanitized = sanitized.replace(sig.regex, '[REDACTED_BY_CODESYNC_SECURITY]');
    }
    return sanitized;
  }

  /**
   * Emergency Access Revocation (Lockdown)
   */
  async emergencyRevocation({ targetType = 'workspace', targetId, reason, initiatedBy }) {
    let affectedCount = 0;

    if (targetType === 'workspace') {
      const [count] = await EphemeralCredential.update(
        { status: 'revoked' },
        { where: { workspaceId: targetId, status: 'active' } }
      );
      affectedCount = count;
    } else if (targetType === 'user') {
      const [count] = await EphemeralCredential.update(
        { status: 'revoked' },
        { where: { issuedToUser: targetId, status: 'active' } }
      );
      affectedCount = count;
    } else if (targetType === 'organization') {
      const [count] = await EphemeralCredential.update(
        { status: 'revoked' },
        { where: { status: 'active' } }
      );
      affectedCount = count;
    }

    await CredentialAuditLog.create({
      workspaceId: targetType === 'workspace' ? targetId : null,
      userId: initiatedBy,
      workloadIdentity: 'spiffe://codesync.internal/admin/lockdown',
      providerType: 'all',
      resourceTarget: `${targetType}:${targetId || 'global'}`,
      operation: 'emergency-revoke',
      environment: 'all',
      action: 'emergency_lockdown',
      reason: reason || `Emergency access revocation executed by user #${initiatedBy}. Revoked ${affectedCount} active credentials.`,
    });

    return {
      success: true,
      revokedCredentialsCount: affectedCount,
      targetType,
      targetId,
      timestamp: new Date().toISOString(),
    };
  }
}

const credentialBrokerService = new CredentialBrokerService();
export { credentialBrokerService };
export default credentialBrokerService;
