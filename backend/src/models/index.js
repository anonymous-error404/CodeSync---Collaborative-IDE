import sequelize from '../config/database.js';
import User from './User.js';
import WorkspaceMember from './WorkspaceMember.js';
import WorkspaceInvite from './WorkspaceInvite.js';
import Whiteboard from './Whiteboard.js';
import TeachingSession from './TeachingSession.js';
import ProjectTask from './ProjectTask.js';
import CodeReview from './CodeReview.js';
import WorkspaceLock from './WorkspaceLock.js';
import LineComment from './LineComment.js';

// Feature 5 Models
import PreviewEnvironment from './PreviewEnvironment.js';
import PreviewAnnotation from './PreviewAnnotation.js';
import ReviewMemo from './ReviewMemo.js';

// Feature 6 Models
import CredentialProvider from './CredentialProvider.js';
import EphemeralCredential from './EphemeralCredential.js';
import CredentialPolicy from './CredentialPolicy.js';
import CredentialAuditLog from './CredentialAuditLog.js';

// Feature 10 Models
import GoldenPathBlueprint from './GoldenPathBlueprint.js';
import IDPExecution from './IDPExecution.js';
import IDPPolicy from './IDPPolicy.js';

WorkspaceMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(WorkspaceMember, { foreignKey: 'userId' });

WorkspaceInvite.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
TeachingSession.belongsTo(User, { as: 'teacher', foreignKey: 'teacherUserId' });

// Professional workspace associations
ProjectTask.belongsTo(User, { as: 'assignee', foreignKey: 'assignedTo' });
ProjectTask.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
CodeReview.belongsTo(User, { as: 'author', foreignKey: 'authorId' });
CodeReview.belongsTo(User, { as: 'reviewer', foreignKey: 'reviewerId' });

WorkspaceLock.belongsTo(User, { as: 'locker', foreignKey: 'lockedBy' });

// Line Comment associations
LineComment.belongsTo(User, { as: 'author', foreignKey: 'userId' });
User.hasMany(LineComment, { foreignKey: 'userId' });
LineComment.hasMany(LineComment, { as: 'replies', foreignKey: 'parentId' });
LineComment.belongsTo(LineComment, { as: 'parent', foreignKey: 'parentId' });

// Feature 5 associations
PreviewEnvironment.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
PreviewEnvironment.hasMany(PreviewAnnotation, { as: 'annotations', foreignKey: 'previewId', onDelete: 'CASCADE' });
PreviewAnnotation.belongsTo(PreviewEnvironment, { as: 'preview', foreignKey: 'previewId' });
PreviewAnnotation.belongsTo(User, { as: 'author', foreignKey: 'createdBy' });
PreviewAnnotation.belongsTo(User, { as: 'assignee', foreignKey: 'assignedTo' });

ReviewMemo.belongsTo(PreviewEnvironment, { as: 'preview', foreignKey: 'previewId' });
ReviewMemo.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

// Feature 6 associations
EphemeralCredential.belongsTo(CredentialProvider, { as: 'provider', foreignKey: 'providerId' });
EphemeralCredential.belongsTo(User, { as: 'user', foreignKey: 'issuedToUser' });
CredentialProvider.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
CredentialAuditLog.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Feature 10 associations
IDPExecution.belongsTo(GoldenPathBlueprint, { as: 'blueprint', foreignKey: 'blueprintId' });
IDPExecution.belongsTo(User, { as: 'initiator', foreignKey: 'initiatedBy' });

const db = {
  sequelize,
  User,
  WorkspaceMember,
  WorkspaceInvite,
  Whiteboard,
  TeachingSession,
  ProjectTask,
  CodeReview,
  WorkspaceLock,
  LineComment,
  PreviewEnvironment,
  PreviewAnnotation,
  ReviewMemo,
  CredentialProvider,
  EphemeralCredential,
  CredentialPolicy,
  CredentialAuditLog,
  GoldenPathBlueprint,
  IDPExecution,
  IDPPolicy,
};

/**
 * Seed initial Golden Path Blueprints and sample policies if empty
 */
const seedInitialData = async () => {
  try {
    const blueprintCount = await GoldenPathBlueprint.count();
    if (blueprintCount === 0) {
      console.log('[IDP Seed]: Seeding default Golden Path blueprints...');
      await GoldenPathBlueprint.bulkCreate([
        {
          id: 'gp-go-microservice',
          name: 'Production Go Microservice',
          category: 'backend',
          description: 'Standardized enterprise Go 1.22 microservice with Chi router, gRPC support, OpenTelemetry tracing, and Docker multi-stage build.',
          ownerTeam: 'Platform Backend Team',
          version: '2.4.0',
          sourceProvider: 'backstage',
          tags: ['Go 1.22', 'gRPC', 'PostgreSQL', 'Docker', 'OpenTelemetry'],
          approved: true,
          inputsSchema: [
            { id: 'serviceName', label: 'Service Name', type: 'text', default: 'payments-service', required: true },
            { id: 'database', label: 'Primary Database', type: 'select', options: ['PostgreSQL 16', 'MySQL 8', 'None'], default: 'PostgreSQL 16' },
            { id: 'cache', label: 'Caching Layer', type: 'select', options: ['Redis Cluster', 'In-Memory', 'None'], default: 'Redis Cluster' },
            { id: 'telemetry', label: 'Telemetry & Metrics', type: 'boolean', default: true },
          ],
          dependencyGraph: [
            { id: 'dep-db', name: 'PostgreSQL Database', type: 'database', order: 1, provides: ['DATABASE_URL'] },
            { id: 'dep-cache', name: 'Redis Cache Layer', type: 'cache', order: 1, provides: ['REDIS_URL'] },
            { id: 'dep-app', name: 'Go Service Runtime', type: 'application', order: 2, dependsOn: ['dep-db', 'dep-cache'] },
            { id: 'dep-observability', name: 'Prometheus & Jaeger Exporter', type: 'observability', order: 3, dependsOn: ['dep-app'] },
          ],
          infrastructureSpec: {
            iacProvider: 'terraform',
            resources: ['aws_ecs_service', 'aws_rds_instance', 'aws_elasticache_cluster'],
          },
          ciCdSpec: {
            pipeline: 'github-actions',
            qualityGates: ['go vet', 'golangci-lint', 'code-coverage > 80%'],
          },
          securityPolicy: {
            secretScanning: true,
            brokerEnforced: true,
            containerScanning: true,
          },
        },
        {
          id: 'gp-nextjs-enterprise',
          name: 'Next.js Enterprise Web Platform',
          category: 'frontend',
          description: 'Production-ready Next.js 15 App Router platform with Tailwind CSS, TypeScript, Figma Design Tokens, and authenticated preview environment integration.',
          ownerTeam: 'Core Frontend Team',
          version: '3.1.0',
          sourceProvider: 'copier',
          tags: ['Next.js 15', 'TypeScript', 'Tailwind', 'Auth0', 'Vercel/Docker'],
          approved: true,
          inputsSchema: [
            { id: 'appName', label: 'Application Name', type: 'text', default: 'customer-portal', required: true },
            { id: 'stateManager', label: 'State Management', type: 'select', options: ['Zustand', 'Redux Toolkit', 'React Context'], default: 'Zustand' },
            { id: 'enablePreviewPins', label: 'Enable Figma-Style Review Pins', type: 'boolean', default: true },
            { id: 'authProvider', label: 'Authentication Provider', type: 'select', options: ['CodeSync Zero-Trust Broker', 'NextAuth', 'Auth0'], default: 'CodeSync Zero-Trust Broker' },
          ],
          dependencyGraph: [
            { id: 'dep-ui-tokens', name: 'Design Tokens Sync', type: 'design', order: 1 },
            { id: 'dep-frontend', name: 'Next.js Build & SSR Runner', type: 'application', order: 2, dependsOn: ['dep-ui-tokens'] },
            { id: 'dep-preview-gw', name: 'Preview Gateway Ingress', type: 'gateway', order: 3, dependsOn: ['dep-frontend'] },
          ],
          infrastructureSpec: {
            iacProvider: 'crossplane',
            resources: ['CloudflarePage', 'AWSS3Bucket'],
          },
          ciCdSpec: {
            pipeline: 'github-actions',
            qualityGates: ['eslint', 'tsc --noEmit', 'playwright-e2e'],
          },
          securityPolicy: {
            secretScanning: true,
            cspStrict: true,
          },
        },
        {
          id: 'gp-python-aiml',
          name: 'Python AI/ML Model Service & Eval Pipeline',
          category: 'ai_ml',
          description: 'Standardized ML service with FastAPI, PyTorch inference server, MLflow experiment tracking, and automated evaluation benchmarking.',
          ownerTeam: 'Applied AI & ML Platform',
          version: '1.8.2',
          sourceProvider: 'cookiecutter',
          tags: ['Python 3.12', 'FastAPI', 'PyTorch', 'MLflow', 'CUDA'],
          approved: true,
          inputsSchema: [
            { id: 'modelName', label: 'Model Identifier', type: 'text', default: 'fraud-detector-v1', required: true },
            { id: 'framework', label: 'Framework', type: 'select', options: ['PyTorch', 'TensorFlow', 'HuggingFace Transformers', 'Scikit-Learn'], default: 'PyTorch' },
            { id: 'gpuAcceleration', label: 'GPU Hardware Acceleration', type: 'boolean', default: false },
          ],
          dependencyGraph: [
            { id: 'dep-model-store', name: 'Model Registry S3 Store', type: 'storage', order: 1 },
            { id: 'dep-inference-api', name: 'FastAPI Inference Container', type: 'application', order: 2, dependsOn: ['dep-model-store'] },
            { id: 'dep-eval-harness', name: 'Automated Evaluation Harness', type: 'eval', order: 3, dependsOn: ['dep-inference-api'] },
          ],
          infrastructureSpec: {
            iacProvider: 'helm',
            resources: ['KubernetesDeployment', 'KServeInferenceService'],
          },
          ciCdSpec: {
            pipeline: 'github-actions',
            qualityGates: ['pytest', 'ruff', 'benchmark-latency < 50ms'],
          },
          securityPolicy: {
            secretScanning: true,
            brokerEnforced: true,
          },
        },
        {
          id: 'gp-distributed-cloud',
          name: 'Distributed Cloud Multi-Service Cluster',
          category: 'distributed',
          description: 'Multi-service event-driven cluster with Apache Kafka, PostgreSQL replicas, Redis pub/sub, and unified OpenTelemetry tracing.',
          ownerTeam: 'Platform Architecture',
          version: '4.0.1',
          sourceProvider: 'helm',
          tags: ['Kafka', 'PostgreSQL', 'Redis', 'Kubernetes', 'Distributed'],
          approved: true,
          inputsSchema: [
            { id: 'clusterName', label: 'Cluster Namespace', type: 'text', default: 'logistics-mesh', required: true },
            { id: 'partitions', label: 'Kafka Topic Partitions', type: 'select', options: ['3 Partitions', '6 Partitions', '12 Partitions'], default: '3 Partitions' },
          ],
          dependencyGraph: [
            { id: 'dep-kafka', name: 'Apache Kafka Broker', type: 'messaging', order: 1 },
            { id: 'dep-postgres', name: 'PostgreSQL Primary & Replica', type: 'database', order: 1 },
            { id: 'dep-mesh', name: 'Service Mesh Ingress & Gateway', type: 'gateway', order: 2, dependsOn: ['dep-kafka', 'dep-postgres'] },
          ],
          infrastructureSpec: {
            iacProvider: 'terraform',
            resources: ['aws_msk_cluster', 'aws_rds_cluster'],
          },
          ciCdSpec: {
            pipeline: 'argo-cd',
            qualityGates: ['chaos-testing', 'canary-verification'],
          },
          securityPolicy: {
            secretScanning: true,
            spiffeIdentityRequired: true,
          },
        },
      ]);
      console.log('[IDP Seed]: Default Golden Path blueprints created.');
    }

    const policyCount = await CredentialPolicy.count();
    if (policyCount === 0) {
      await CredentialPolicy.bulkCreate([
        {
          name: 'Development Environment Safe Sandbox',
          environment: 'development',
          role: 'all',
          workloadPattern: 'spiffe://codesync.internal/*',
          allowedResources: ['s3:*-dev-*', 'pg:dev_*', 'stripe:test_*', 'vault:secret/dev/*'],
          allowedOperations: ['read', 'write', 'list'],
          requiresApproval: false,
          maxTtlMinutes: 120,
          description: 'Allows reading and writing to isolated development databases, S3 test buckets, and Stripe sandbox.',
        },
        {
          name: 'Preview & QA Environment Restricted Access',
          environment: 'preview',
          role: 'all',
          workloadPattern: 'spiffe://codesync.internal/ns/preview/*',
          allowedResources: ['s3:*-preview-*', 'pg:preview_*', 'mock:*', 'stripe:test_*'],
          allowedOperations: ['read', 'write'],
          requiresApproval: false,
          maxTtlMinutes: 60,
          description: 'Enforces strict isolation for review previews with mock/test tokens and read access only.',
        },
        {
          name: 'Production Elevation & Break-Glass Gate',
          environment: 'production',
          role: 'team_leader',
          workloadPattern: 'spiffe://codesync.internal/ns/prod/*',
          allowedResources: ['*'],
          allowedOperations: ['read', 'write', 'deploy'],
          requiresApproval: true,
          maxTtlMinutes: 15,
          description: 'Requires explicit administrator authorization and provides time-bound 15-minute emergency tokens.',
        },
      ]);
      console.log('[Credential Policies]: Default policies seeded.');
    }

    // Purge any previously seeded dummy providers for clean production state
    await CredentialProvider.destroy({
      where: {
        name: [
          'AWS Cloud IAM (STS Token Broker)',
          'HashiCorp Vault Dynamic Secrets',
          'Stripe Sandbox Payment Broker',
        ],
      },
    });
  } catch (err) {
    console.warn('[Seed Notice]: Could not seed initial data:', err.message);
  }
};

/**
 * Initialize database and sync models
 * @param {object} options
 */
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.authenticate();
    console.log('[Database]: SQLite connection established successfully.');

    // Cleanup any lingering backup tables from previous interrupted alters
    await sequelize.query('DROP TABLE IF EXISTS `users_backup`;');
    await sequelize.query('DROP TABLE IF EXISTS `workspace_members_backup`;');
    await sequelize.query('DROP TABLE IF EXISTS `teaching_sessions_backup`;');
    await sequelize.query('DROP TABLE IF EXISTS `project_tasks_backup`;');
    await sequelize.query('DROP TABLE IF EXISTS `code_reviews_backup`;');
    await sequelize.query('DROP TABLE IF EXISTS `workspace_locks_backup`;');

    await sequelize.sync(options);

    // Auto-migrate: ensure new columns exist in users
    try {
      const [userCols] = await sequelize.query("PRAGMA table_info('users');");
      const userColNames = (userCols || []).map(c => c.name);
      if (userColNames.length > 0) {
        if (!userColNames.includes('githubToken')) {
          await sequelize.query("ALTER TABLE users ADD COLUMN githubToken TEXT DEFAULT NULL;");
        }
        if (!userColNames.includes('githubUsername')) {
          await sequelize.query("ALTER TABLE users ADD COLUMN githubUsername TEXT DEFAULT NULL;");
        }
      }
    } catch (uErr) {
      console.warn('[Database Notice]: Column check on users:', uErr.message);
    }

    // Auto-migrate: ensure new columns exist in workspace_members
    try {
      const [cols] = await sequelize.query("PRAGMA table_info('workspace_members');");
      const colNames = (cols || []).map(c => c.name);

      if (colNames.length > 0) {
        if (!colNames.includes('studentAccess')) {
          await sequelize.query("ALTER TABLE workspace_members ADD COLUMN studentAccess TEXT DEFAULT 'viewer';");
        }
        if (!colNames.includes('sessionRole')) {
          await sequelize.query("ALTER TABLE workspace_members ADD COLUMN sessionRole TEXT DEFAULT 'none';");
        }
        if (!colNames.includes('editorLocked')) {
          await sequelize.query("ALTER TABLE workspace_members ADD COLUMN editorLocked TINYINT(1) DEFAULT 0;");
        }
        if (!colNames.includes('handRaised')) {
          await sequelize.query("ALTER TABLE workspace_members ADD COLUMN handRaised TINYINT(1) DEFAULT 0;");
        }
      }
    } catch (colErr) {
      console.warn('[Database Notice]: Column check on workspace_members:', colErr.message);
    }

    await seedInitialData();

    console.log('[Database]: All Models (Core + Preview Hub + Zero-Trust Credential Broker + IDP Golden Paths) synchronized.');
  } catch (error) {
    console.error('[Database Error]: Failed to connect or sync database:', error);
    throw error;
  }
};

export { syncDatabase };
export default db;
export {
  User,
  WorkspaceMember,
  WorkspaceInvite,
  Whiteboard,
  TeachingSession,
  ProjectTask,
  CodeReview,
  WorkspaceLock,
  LineComment,
  PreviewEnvironment,
  PreviewAnnotation,
  ReviewMemo,
  CredentialProvider,
  EphemeralCredential,
  CredentialPolicy,
  CredentialAuditLog,
  GoldenPathBlueprint,
  IDPExecution,
  IDPPolicy,
};
