import workspaceService from '../services/workspaceService.js';
import storageService from '../services/storageService.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import { Op } from 'sequelize';
import {
  WorkspaceMember,
  WorkspaceInvite,
  LineComment,
  Whiteboard,
  TeachingSession,
  ProjectTask,
  CodeReview,
  WorkspaceLock,
  User,
} from '../models/index.js';
import { checkPathLocked } from './lockController.js';
import { broadcastFileTreeUpdate } from '../sockets/workspaceSocket.js';

// Project template definitions — maps template key to initial file tree
const PROJECT_TEMPLATES = {
  'node-express': {
    'package.json': JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
      main: 'index.js',
      scripts: { start: 'node index.js', dev: 'node index.js' },
      dependencies: { express: '^4.18.0' }
    }, null, 2),
    'index.js': `const express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Hello World!' });\n});\n\napp.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));\n`,
    'README.md': `# Node.js Express App\n\nRun: \`npm install && npm run dev\`\n`,
  },
  'python-flask': {
    'app.py': `import os\nfrom flask import Flask, jsonify\n\napp = Flask(__name__)\n\n@app.route('/')\ndef hello():\n    return jsonify({'message': 'Hello World!'})\n\nif __name__ == '__main__':\n    port = int(os.environ.get('PORT', 8000))\n    app.run(host='0.0.0.0', port=port, debug=True)\n`,
    'requirements.txt': `flask>=3.0.0\n`,
    'README.md': `# Python Flask App\n\nRun: \`pip install -r requirements.txt && python app.py\`\n`,
  },
  'python-script': {
    'main.py': `# Python Script\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n`,
    'README.md': `# Python Script\n\nRun: \`python main.py\`\n`,
  },
  'java-maven': {
    'src/main/java/Main.java': `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
    'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0"\n  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.codesync</groupId>\n  <artifactId>my-app</artifactId>\n  <version>1.0-SNAPSHOT</version>\n  <properties>\n    <maven.compiler.source>21</maven.compiler.source>\n    <maven.compiler.target>21</maven.compiler.target>\n  </properties>\n</project>\n`,
    'README.md': `# Java Maven Project\n\nCompile: \`mvn compile\`  Run: \`mvn exec:java -Dexec.mainClass="Main"\`\n`,
  },
  'react-vite': {
    'package.json': JSON.stringify({
      name: 'my-react-app',
      version: '0.0.0',
      scripts: { dev: 'vite --host', build: 'vite build' },
      dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', vite: '^6.0.0' },
      devDependencies: { vite: '^6.0.0', '@vitejs/plugin-react': '^4.0.0' }
    }, null, 2),
    'index.html': `<!doctype html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><title>React App</title></head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
    'src/main.jsx': `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);\n`,
    'src/App.jsx': `export default function App() {\n  return <h1>Hello from React!</h1>;\n}\n`,
    'README.md': `# React + Vite\n\nRun: \`npm install && npm run dev\`\n`,
  },
  'gp-go-microservice': {
    'go.mod': `module payments-service\n\ngo 1.22\n\nrequire github.com/go-chi/chi/v5 v5.0.12\n`,
    'main.go': `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"github.com/go-chi/chi/v5"\n)\n\nfunc main() {\n\tr := chi.NewRouter()\n\tr.Get("/health", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Write([]byte("{\\"status\\":\\"healthy\\",\\"service\\":\\"payments-service\\"}"))\n\t})\n\tr.Get("/api/v1/charge", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Write([]byte("{\\"charged\\":true,\\"provider\\":\\"zero-trust-broker\\"}"))\n\t})\n\tfmt.Println("Enterprise Go Microservice listening on :8080")\n\thttp.ListenAndServe(":8080", r)\n}\n`,
    'Dockerfile': `FROM golang:1.22-alpine AS builder\nWORKDIR /app\nCOPY . .\nRUN go build -o server .\nFROM alpine:3.20\nWORKDIR /app\nCOPY --from=builder /app/server .\nEXPOSE 8080\nCMD ["./server"]\n`,
    'README.md': `# Production Go Microservice (Golden Path)\n\nScaffolded via enterprise Backstage blueprint.\nIncludes Chi HTTP router, OpenTelemetry sidecars, and Zero-Trust Broker dynamic credentials.\n`,
  },
  'gp-nextjs-enterprise': {
    'package.json': JSON.stringify({
      name: 'nextjs-enterprise',
      version: '1.0.0',
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0', lucide: '^0.400.0' }
    }, null, 2),
    'app/page.tsx': `export default function Home() {\n  return (\n    <main className="p-8">\n      <h1 className="text-2xl font-bold">Enterprise Next.js Platform</h1>\n      <p>Configured with CodeSync Zero-Trust Credential Broker & Review Hub Pins.</p>\n    </main>\n  );\n}\n`,
    'README.md': `# Next.js Enterprise Platform (Golden Path)\n\nScaffolded with Copier blueprint. Connected to CodeSync Universal Review Hub.\n`,
  },
  'gp-python-aiml': {
    'main.py': `import os\nfrom fastapi import FastAPI\n\napp = FastAPI(title="AI/ML Model Inference Service")\n\n@app.get("/health")\ndef health():\n    return {"status": "healthy", "model_version": "v1.8.2"}\n\n@app.post("/predict")\ndef predict(payload: dict):\n    return {"prediction": "clean", "confidence": 0.985, "inference_ms": 12.4}\n\nif __name__ == "__main__":\n    import uvicorn\n    uvicorn.run(app, host="0.0.0.0", port=8000)\n`,
    'requirements.txt': `fastapi>=0.110.0\nuvicorn>=0.28.0\n`,
    'README.md': `# Python AI/ML Service & Eval Pipeline (Golden Path)\n\nFastAPI model serving with automated evaluation benchmarks and isolated preview environments.\n`,
  },
  'gp-distributed-cloud': {
    'docker-compose.yml': `version: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - "8080:8080"\n    environment:\n      - DATABASE_URL=postgres://user:pass@postgres:5432/app_db\n      - REDIS_URL=redis://redis:6379\n  postgres:\n    image: postgres:16-alpine\n  redis:\n    image: redis:7-alpine\n`,
    'README.md': `# Distributed Cloud Multi-Service Cluster (Golden Path)\n\nEvent-driven microservice mesh with PostgreSQL, Redis, and SPIFFE workload identity.\n`,
  },
  'blank': null, // use default README only
};

/**
 * POST /api/workspaces
 * Creates a new workspace.
 * Supports types: 'educational', 'professional', 'competitive'
 * Optional body field: template — one of 'node-express', 'python-flask', 'python-script', 'java-maven', 'react-vite', 'blank'
 */
const createWorkspace = asyncWrapper(async (req, res) => {
  const { name, description, type, allowedEmails, template, gitRepoUrl, gitBranch, gitToken, gitUsername } = req.body;

  // Resolve template files (null = use default README)
  const templateKey = template && PROJECT_TEMPLATES.hasOwnProperty(template) ? template : 'blank';
  const templateFiles = PROJECT_TEMPLATES[templateKey] || null;
  const validTypes = ['educational', 'professional', 'competitive'];
  const workspaceType = validTypes.includes(type) ? type : 'educational';

  const userEmail = (req.user?.email || '').toLowerCase().trim();
  const rawEmails = Array.isArray(allowedEmails) ? allowedEmails : [];
  let normalized = rawEmails
    .map(e => (typeof e === 'string' ? e.toLowerCase().trim() : ''))
    .filter(Boolean);

  // In competitive workspaces, the creator/admin MUST always be in the allowed list of accounts
  if (workspaceType === 'competitive' && userEmail && !normalized.includes(userEmail)) {
    normalized.unshift(userEmail);
  }

  if (workspaceType === 'competitive' && normalized.length > 0) {
    const existing = await User.findAll({
      where: { email: { [Op.in]: normalized } },
      attributes: ['email'],
    });
    const existingSet = new Set(existing.map(u => u.email.toLowerCase()));
    const unregistered = normalized.filter(e => !existingSet.has(e));
    if (unregistered.length > 0) {
      return res.status(400).json({
        success: false,
        error: `The following email(s) are not registered on CodeSync: ${unregistered.join(', ')}. Team members must have an existing CodeSync account.`
      });
    }
  }

  const resolvedGitToken = gitToken || req.user?.githubToken || null;
  const resolvedGitUser = gitUsername || req.user?.githubUsername || req.user?.username || null;

  const workspace = await workspaceService.createWorkspace({
    name,
    description,
    type: workspaceType,
    allowedEmails: normalized,
    createdBy: req.user.id,
    creatorEmail: userEmail,
    templateFiles,
    gitRepoUrl: gitRepoUrl ? gitRepoUrl.trim() : null,
    gitBranch: gitBranch ? gitBranch.trim() : null,
    gitToken: resolvedGitToken,
    gitUsername: resolvedGitUser,
    authorName: req.user?.username,
    authorEmail: req.user?.email,
  });

  const initialRole =
    workspaceType === 'educational'
      ? 'teacher'
      : workspaceType === 'professional'
        ? 'team_leader'
        : 'admin';

  const initialAccess =
    workspaceType === 'educational'
      ? 'editor'
      : workspaceType === 'competitive'
        ? 'commenter' // Admin can view and comment only!
        : 'editor';

  await WorkspaceMember.create({
    workspaceId: workspace.id,
    userId: req.user.id,
    role: initialRole,
    studentAccess: initialAccess,
  });

  res.status(201).json({
    success: true,
    workspace: {
      ...workspace,
      myRole: initialRole,
      studentAccess: initialAccess,
      allowedEmails: workspace.allowedEmails || [],
    },
  });
});

/**
 * GET /api/workspaces
 * Lists all active workspaces for the current user
 */
const listWorkspaces = asyncWrapper(async (req, res) => {
  const memberships = await WorkspaceMember.findAll({
    where: { userId: req.user.id },
  });

  const userEmail = (req.user?.email || '').toLowerCase().trim();

  const allWorkspaces = await workspaceService.listWorkspaces();
  const memberMap = new Map(memberships.map(m => [m.workspaceId, m]));

  const workspaces = allWorkspaces
    .filter(w => {
      if (memberMap.has(w.id)) return true;
      if (w.type === 'competitive') {
        const isCreator =
          (req.user?.id && w.createdBy === req.user.id) ||
          (userEmail && (w.creatorEmail === userEmail || w.adminEmail === userEmail));
        if (isCreator) return true;
        const allowed = (w.allowedEmails || []).map(e => (typeof e === 'string' ? e.toLowerCase().trim() : ''));
        if (userEmail && allowed.includes(userEmail)) return true;
      }
      return false;
    })
    .map(w => {
      const m = memberMap.get(w.id);
      const isCreator =
        (req.user?.id && w.createdBy === req.user.id) ||
        (userEmail && (w.creatorEmail === userEmail || w.adminEmail === userEmail));
      const role = m ? m.role : (w.type === 'competitive' && isCreator ? 'admin' : 'team_member');
      const access = m ? m.studentAccess : (role === 'admin' ? 'commenter' : 'editor');
      return {
        ...w,
        type: w.type || 'educational',
        myRole: role,
        studentAccess: access,
        allowedEmails: w.allowedEmails || [],
      };
    });

  res.status(200).json({ success: true, workspaces });
});

/**
 * GET /api/workspaces/:id
 * Fetches details and file tree for a workspace.
 */
const getWorkspaceDetails = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const details = await workspaceService.getWorkspaceDetails(id);
  let membership =
    req.membership ||
    (await WorkspaceMember.findOne({
      where: { workspaceId: id, userId: req.user?.id },
    }));

  const wsType = details.workspace?.type || 'educational';

  // In competitive workspaces: check allowlist & admin access
  if (wsType === 'competitive') {
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const allowed = (details.workspace?.allowedEmails || []).map(e => (typeof e === 'string' ? e.toLowerCase().trim() : ''));
    const isDirectAdmin =
      membership?.role === 'admin' ||
      membership?.role === 'owner' ||
      (userEmail && (details.workspace?.creatorEmail === userEmail || details.workspace?.adminEmail === userEmail)) ||
      (req.user?.id && details.workspace?.createdBy === req.user.id);

    if (isDirectAdmin) {
      // If user is direct creator/admin, ensure they have role 'admin'
      if (!membership) {
        membership = await WorkspaceMember.create({
          workspaceId: id,
          userId: req.user.id,
          role: 'admin',
          studentAccess: 'commenter',
        });
      } else if (membership.role !== 'admin' && membership.role !== 'owner') {
        membership.role = 'admin';
        membership.studentAccess = 'commenter';
        await membership.save();
      }
    } else {
      if (!userEmail || !allowed.includes(userEmail)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Only registered team members on the email allowlist can access this workspace.',
        });
      }
      // Auto-create or ensure team_member
      if (!membership) {
        membership = await WorkspaceMember.create({
          workspaceId: id,
          userId: req.user.id,
          role: 'team_member',
          studentAccess: 'editor',
        });
      }
    }
  }

  const role = membership?.role || (wsType === 'competitive' ? 'team_member' : 'viewer');
  const access = membership?.studentAccess || (role === 'admin' ? 'commenter' : 'editor');

  res.status(200).json({
    success: true,
    ...details,
    workspace: {
      ...(details.workspace || {}),
      type: wsType,
      myRole: role,
      studentAccess: access,
      allowedEmails: details.workspace?.allowedEmails || [],
    },
    myRole: role,
    studentAccess: access,
    allowedEmails: details.workspace?.allowedEmails || [],
  });
});

/**
 * DELETE /api/workspaces/:id
 * Deletes a workspace, its associated database rows, and its files.
 */
const deleteWorkspace = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  // Clean up all related database rows
  await Promise.allSettled([
    WorkspaceMember.destroy({ where: { workspaceId: id } }),
    WorkspaceInvite.destroy({ where: { workspaceId: id } }),
    LineComment.destroy({ where: { workspaceId: id } }),
    Whiteboard.destroy({ where: { workspaceId: id } }),
    TeachingSession.destroy({ where: { workspaceId: id } }),
    ProjectTask.destroy({ where: { workspaceId: id } }),
    CodeReview.destroy({ where: { workspaceId: id } }),
    WorkspaceLock.destroy({ where: { workspaceId: id } }),
  ]);

  await workspaceService.deleteWorkspace(id);
  res.status(200).json({ success: true, message: `Workspace ${id} deleted successfully` });
});

/**
 * POST /api/workspaces/bulk-delete
 * Bulk deletes multiple workspaces and all their resources.
 */
const bulkDeleteWorkspaces = asyncWrapper(async (req, res) => {
  const { workspaceIds } = req.body;
  const userId = req.user.id;

  if (!Array.isArray(workspaceIds) || workspaceIds.length === 0) {
    return res.status(400).json({ success: false, error: 'workspaceIds array is required' });
  }

  const ownerRoles = ['owner', 'teacher', 'team_leader', 'admin'];
  const deletedIds = [];
  const failedIds = [];

  for (const id of workspaceIds) {
    try {
      let membership = await WorkspaceMember.findOne({
        where: { workspaceId: id, userId },
      });

      const ws = await workspaceService.getWorkspace(id);
      const userEmail = (req.user?.email || '').toLowerCase().trim();
      const isCreator =
        (userId && ws?.createdBy === userId) ||
        (userEmail && (ws?.creatorEmail === userEmail || ws?.adminEmail === userEmail));

      if (!membership && isCreator) {
        membership = { role: ws?.type === 'educational' ? 'teacher' : ws?.type === 'professional' ? 'team_leader' : 'admin' };
      }

      if (!membership && ws?.type === 'competitive') {
        const isAdminSomewhere = await WorkspaceMember.findOne({
          where: { userId, role: 'admin' },
        });
        if (isAdminSomewhere) {
          membership = { role: 'admin' };
        }
      }

      if (!isCreator && (!membership || !ownerRoles.includes(membership.role))) {
        failedIds.push(id);
        continue;
      }

      await Promise.allSettled([
        WorkspaceMember.destroy({ where: { workspaceId: id } }),
        WorkspaceInvite.destroy({ where: { workspaceId: id } }),
        LineComment.destroy({ where: { workspaceId: id } }),
        Whiteboard.destroy({ where: { workspaceId: id } }),
        TeachingSession.destroy({ where: { workspaceId: id } }),
        ProjectTask.destroy({ where: { workspaceId: id } }),
        CodeReview.destroy({ where: { workspaceId: id } }),
        WorkspaceLock.destroy({ where: { workspaceId: id } }),
      ]);

      await workspaceService.deleteWorkspace(id);
      deletedIds.push(id);
    } catch (err) {
      console.error(`[bulkDeleteWorkspaces] Error deleting workspace ${id}:`, err);
      failedIds.push(id);
    }
  }

  res.status(200).json({
    success: true,
    deletedIds,
    failedIds,
    message: `Successfully deleted ${deletedIds.length} workspace(s)${failedIds.length > 0 ? `, ${failedIds.length} failed` : ''}`,
  });
});

/**
 * GET /api/workspaces/:id/files/tree
 * Fetches the file tree of a workspace.
 */
const getFileTree = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  // In educational workspaces, students can only see files when class is in session
  if (req.membership?.role === 'student') {
    const activeSession = await TeachingSession.findOne({ where: { workspaceId: id, active: true } });
    if (!activeSession) {
      return res.status(200).json({ success: true, fileTree: [], classInSession: false });
    }
  }

  const fileTree = await storageService.getFileTree(id);
  res.status(200).json({ success: true, fileTree, classInSession: true });
});

/**
 * GET /api/workspaces/:id/files/content
 * Reads a specific file content.
 */
const readFileContent = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { filePath } = req.query;

  // In educational workspaces, students can only read files when class is in session
  if (req.membership?.role === 'student') {
    const activeSession = await TeachingSession.findOne({ where: { workspaceId: id, active: true } });
    if (!activeSession) {
      return res.status(403).json({ success: false, error: 'Class is not in session. Please wait for your teacher to start the class.' });
    }
  }

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Query param filePath is required' });
  }

  const fileData = await storageService.readFile(id, filePath);
  res.status(200).json({ success: true, ...fileData });
});

/**
 * PUT /api/workspaces/:id/files/content
 * Saves/writes content to a file.
 */
const saveFileContent = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { filePath, content } = req.body;

  if (req.membership?.role === 'student' && req.membership?.studentAccess !== 'editor') {
    return res.status(403).json({ success: false, error: 'Editing access restricted by teacher' });
  }

  if (req.membership?.sessionRole === 'student' && req.membership?.editorLocked) {
    return res.status(403).json({ success: false, error: 'Your editor is locked by the teacher' });
  }

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Body parameter filePath is required' });
  }

  const lockCheck = await checkPathLocked(id, filePath, req.user?.id);
  if (lockCheck.isLocked) {
    return res.status(423).json({ success: false, error: `File is locked by ${lockCheck.lock.lockedByName}` });
  }

  const result = await storageService.writeFile(id, filePath, content);
  res.status(200).json({ success: true, ...result });
});

/**
 * POST /api/workspaces/:id/files
 * Creates a new file or directory.
 */
const createItem = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { filePath, isDirectory } = req.body;

  if (req.membership?.role === 'student' && req.membership?.studentAccess !== 'editor') {
    return res.status(403).json({ success: false, error: 'File creation restricted by teacher' });
  }

  if (req.membership?.sessionRole === 'student' && req.membership?.editorLocked) {
    return res.status(403).json({ success: false, error: 'Your editor is locked by the teacher' });
  }

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Body parameter filePath is required' });
  }

  const item = await storageService.createItem(id, filePath, !!isDirectory);
  broadcastFileTreeUpdate(id).catch(() => {});
  res.status(201).json({ success: true, item });
});

/**
 * DELETE /api/workspaces/:id/files
 * Deletes a file or directory.
 */
const deleteItem = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { filePath } = req.query;

  if (req.membership?.role === 'student' && req.membership?.studentAccess !== 'editor') {
    return res.status(403).json({ success: false, error: 'File deletion restricted by teacher' });
  }

  if (req.membership?.sessionRole === 'student' && req.membership?.editorLocked) {
    return res.status(403).json({ success: false, error: 'Your editor is locked by the teacher' });
  }

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Query param filePath is required' });
  }

  const lockCheck = await checkPathLocked(id, filePath, req.user?.id);
  if (lockCheck.isLocked) {
    return res.status(423).json({ success: false, error: `Cannot delete: locked by ${lockCheck.lock.lockedByName}` });
  }

  const result = await storageService.deleteItem(id, filePath);
  broadcastFileTreeUpdate(id).catch(() => {});
  res.status(200).json({ success: true, ...result });
});

/**
 * POST /api/workspaces/:id/files/rename
 * Renames a file or directory.
 */
const renameItem = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { oldPath, newPath } = req.body;

  if (req.membership?.role === 'student' && req.membership?.studentAccess !== 'editor') {
    return res.status(403).json({ success: false, error: 'File rename restricted by teacher' });
  }

  if (req.membership?.sessionRole === 'student' && req.membership?.editorLocked) {
    return res.status(403).json({ success: false, error: 'Your editor is locked by the teacher' });
  }

  if (!oldPath || !newPath) {
    return res.status(400).json({ success: false, error: 'Parameters oldPath and newPath are required' });
  }

  const lockCheck = await checkPathLocked(id, oldPath, req.user?.id);
  if (lockCheck.isLocked) {
    return res.status(423).json({ success: false, error: `Cannot rename: locked by ${lockCheck.lock.lockedByName}` });
  }

  const result = await storageService.renameItem(id, oldPath, newPath);
  broadcastFileTreeUpdate(id).catch(() => {});
  res.status(200).json({ success: true, ...result });
});

/**
 * GET /api/workspaces/:id/allowlist
 */
const getAllowlist = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const allowedEmails = await workspaceService.getAllowedEmails(id);
  res.status(200).json({ success: true, allowedEmails });
});

/**
 * POST /api/workspaces/:id/allowlist
 */
const addAllowedEmails = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { emails, email } = req.body;
  const toAdd = emails || (email ? [email] : []);
  const normalized = (Array.isArray(toAdd) ? toAdd : [toAdd])
    .map(e => (typeof e === 'string' ? e.toLowerCase().trim() : ''))
    .filter(Boolean);

  if (normalized.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid email address provided.' });
  }

  // Ensure every email has a registered account on CodeSync
  const existing = await User.findAll({
    where: { email: { [Op.in]: normalized } },
    attributes: ['email'],
  });
  const existingSet = new Set(existing.map(u => u.email.toLowerCase()));
  const unregistered = normalized.filter(e => !existingSet.has(e));
  if (unregistered.length > 0) {
    return res.status(400).json({
      success: false,
      error: `The following email(s) do not have a CodeSync account: ${unregistered.join(', ')}. Team members must be registered users.`
    });
  }

  const updated = await workspaceService.addAllowedEmails(id, normalized);
  res.status(200).json({ success: true, allowedEmails: updated });
});

/**
 * DELETE /api/workspaces/:id/allowlist/:email
 */
const removeAllowedEmail = asyncWrapper(async (req, res) => {
  const { id, email } = req.params;
  const updated = await workspaceService.removeAllowedEmail(id, email);
  res.status(200).json({ success: true, allowedEmails: updated });
});

export {
  createWorkspace,
  listWorkspaces,
  getWorkspaceDetails,
  deleteWorkspace,
  getFileTree,
  readFileContent,
  saveFileContent,
  createItem,
  deleteItem,
  renameItem,
  getAllowlist,
  addAllowedEmails,
  removeAllowedEmail,
  bulkDeleteWorkspaces,
};
