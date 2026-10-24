# ⚡ CodeSync — Collaborative Cloud IDE & Intelligent Whiteboard

CodeSync is a modern, full-stack, cloud-based collaborative development platform inspired by VS Code and StackBlitz. It combines a smart in-browser code editor, real-time multi-user synchronization, isolated Docker execution containers, WebRTC live voice classrooms, real-time chat, an intelligent collaborative whiteboard with AI/NLP diagramming, and agile project management tools.

---

## 📑 Table of Contents

- [Key Highlights](#-key-highlights)
- [Comprehensive Features](#-comprehensive-features)
  - [1. Smart Code Editor](#1-smart-code-editor)
  - [2. VS Code-Style Expandable Terminal](#2-vs-code-style-expandable-terminal)
  - [3. Isolated Docker Code Execution Sandbox](#3-isolated-docker-code-execution-sandbox)
  - [4. Real-Time Collaboration & Synchronization](#4-real-time-collaboration--synchronization)
  - [5. Intelligent Collaborative Whiteboard](#5-intelligent-collaborative-whiteboard)
  - [6. Classroom & Teaching Session Controls](#6-classroom--teaching-session-controls)
  - [7. Professional Agile & Code Review Tools](#7-professional-agile--code-review-tools)
  - [8. WebRTC Live Voice Calling & Workspace Chat](#8-webrtc-live-voice-calling--workspace-chat)
  - [9. Authentication & Granular RBAC](#9-authentication--granular-rbac)
- [🛠️ Tech Stack](#️-tech-stack)
- [📂 Project Directory Structure](#-project-directory-structure)
- [🚀 Quick Start & Installation](#-quick-start--installation)
  - [Prerequisites](#prerequisites)
  - [One-Command Setup (Parent Directory)](#one-command-setup-parent-directory)
  - [Individual Service Setup](#individual-service-setup)
- [⚙️ Environment Configuration](#️-environment-configuration)
  - [Backend Configuration (`backend/.env`)](#backend-configuration-backendenv)
  - [Frontend Configuration (`frontend/.env`)](#frontend-configuration-frontendenv)
- [🔌 API & WebSocket Reference](#-api--websocket-reference)
  - [REST API Endpoints](#rest-api-endpoints)
  - [WebSocket Events (`/workspace` Namespace)](#websocket-events-workspace-namespace)
- [🛡️ Security & Sandboxing Architecture](#️-security--sandboxing-architecture)
- [🤝 Contributing & License](#-contributing--license)

---

## 🌟 Key Highlights

- **Single Command Launch:** Spin up both frontend and backend concurrently from the root directory with `npm run dev`.
- **Zero-Install Cloud Runtimes:** Write and run Python, JavaScript, and Java programs inside isolated Docker containers right from your browser.
- **True Multi-User Real-Time Sync:** Collab cursor overlays, typing indicators, smart cursor reconciliation, and file-level locking.
- **Integrated Classroom Voice Calling:** WebRTC audio broadcasting enables teachers or team leads to speak to everyone in the workspace with zero latency.
- **Dual-Mode Canvas & IDE:** Seamlessly switch between writing code and designing architecture diagrams on the Intelligent Whiteboard.
- **Agile Task Board & Code Reviews:** Manage Kanban sprint tasks and conduct GitHub-style line-by-line code reviews directly inside your IDE workspace.

---

## 🎯 Comprehensive Features

### 1. Smart Code Editor
- **Custom-Built Lightweight Engine:** Clean, high-performance editor with syntax highlighting, line numbers, and dark/light themes.
- **Smart Auto-Closing Pairs:** Automatically closes `()`, `[]`, `{}`, `""`, `''`, and ```` `` ````. Intelligent skip past closing characters and paired backspace deletion.
- **Context-Aware Indentation:** Automatically applies indentation levels based on file language (e.g. following `:` in Python or `{` in JavaScript/Java).
- **Multi-Tab File Management:** Open multiple files simultaneously with active indicators, file extension icons, and unsaved changes indicators (`●`).
- **Keyboard Shortcuts:**
  - `Ctrl + S` / `Cmd + S` — Instantly save the active file to backend storage.
  - `Ctrl + \`` / `Cmd + \`` — Open and toggle the expandable console terminal.

### 2. VS Code-Style Expandable Terminal
- **Draggable Resizer Bar:** Drag the top border of the console to smoothly resize its height between 90px and window bounds with hover accent highlights.
- **Double-Click Maximize/Restore:** Double-click the resizer bar or console title bar to expand the terminal to 100% height (hiding the editor) or restore it to split view.
- **Header Controls:**
  - **Clear:** Wipes console output buffer.
  - **Collapse / Expand (`ChevronUp` / `ChevronDown`):** Minimizes terminal to a compact 36px bar or restores it.
  - **Maximize / Restore (`Maximize2` / `Minimize2`):** Switches between split and full-height view.
  - **Close (`X`):** Hides the terminal panel completely.
- **Auto-Open on Run:** Clicking the "Run" button automatically reveals and expands the console if it was closed or collapsed.

### 3. Isolated Docker Code Execution Sandbox
- **Security-First Ephemeral Containers:** Code executes in short-lived Docker containers with `--network none` (no outgoing or incoming network access) and read/write workspace volume mounts.
- **Configured Resource Limits:** Guaranteed 512MB RAM and 1.0 CPU limit per container, preventing memory starvation during JVM metaspace allocation or Python execution.
- **Live Streaming Output:** Streams `stdout` and `stderr` in real-time over WebSockets directly to the browser console.
- **Supported Languages & Execution Commands:**
  - **JavaScript:** `node:22-alpine` (`node <file>`)
  - **Python:** `python:3.12-alpine` (`python3 -u <file>` unbuffered stdout)
  - **Java:** `eclipse-temurin:21-jdk-alpine` (`javac *.java 2>/dev/null; java "<file>"` supporting both multi-class projects and JEP 330 single-file source-code launcher with casing tolerance)
- **Execution Safeguards:** 30-second automated execution timeout guard to prevent infinite loops, plus a manual "Stop" button (`stop-execution`).
- **Multi-Member Environment Modal:** Inspect running container statuses and stop active execution tasks across workspace members.

### 4. Real-Time Collaboration & Synchronization
- **Remote Collaborator Cursors:** View other users' cursors with deterministic color coding, username labels, selection ranges, and real-time `(typing...)` badges.
- **Smart Cursor Reconciliation:** The `adjustCursorForRemoteChange` algorithm anchors local and remote cursors to code positions during concurrent remote edits.
- **Granular File & Line Locking (`LockManagerModal`):**
  - Lock entire files or specific line ranges (`startLine` to `endLine`) to prevent edit collisions during critical modifications.
  - View lock reasons, locker names, and release locks when work is finished.
- **Active Member Presence:** Displays active collaborator avatars in the top navigation bar.

### 5. Intelligent Collaborative Whiteboard
- **Infinite Vector Canvas:** Pan, zoom, and draw diagrams, flowcharts, and system designs.
- **Rich Toolkit:**
  - Shapes: Rectangles, Diamonds (decisions), Circles/Ellipses, Arrows, Connectors, Freehand pen.
  - Annotations: Text blocks and colorful Sticky Notes.
  - **Executable Code Cells (`CodeCellNode`):** Write, view, and run code directly on the canvas, or click "Open in IDE" to open it in a tab.
  - **Mathematical Equations (`EquationNode`):** Render math formulas directly on the board.
- **AI & NLP Diagram Assistance:**
  - **Stroke Recognition (`strokeRecognition.ts`):** Converts rough hand-drawn freehand sketches into polished geometric shapes.
  - **Text-to-Diagram Generator (`textToDiagramParser.ts`):** Creates structured flowcharts and architectures from text descriptions.
  - **NLP Command Palette (`nlpCommandParser.ts`):** Natural language commands to add nodes, connect elements, and re-arrange canvas items.
  - **Auto Graph Layout (`graphLayout.ts`):** Algorithmic hierarchical layout and tree organization for clean architectural diagrams.
  - **Diagram Validation (`diagramValidator.ts`):** Scans flowcharts and system diagrams for orphan nodes, dead ends, or cycle anomalies.
- **Task Proposal System (`TaskProposalModal`):** Convert architectural diagram components into actionable Kanban project tasks with a single click.

### 6. Classroom & Teaching Session Controls
- **Teacher & Student Roles:** Tailored interface modes for educational institutions and pair-programming bootcamps.
- **Focus Mode:** The teacher forces all students' active IDE tabs to automatically follow the teacher's selected file in real-time.
- **Remote Editor Locking:** Teachers can lock a specific student's editor or lock all students simultaneously (`session:lock_all`) during explanations.
- **Teacher Takeover:** Teachers can remotely take over and edit a student's file to demonstrate solutions live.
- **Hand Raising & Help Requests:** Students can raise their hands (`session:raise_hand`) or send priority help requests to the instructor.
- **Student Access Tiers:** Dynamic permission toggling between `no-view`, `viewer`, and `editor`.

### 7. Professional Agile & Code Review Tools
- **Project Task Manager (Kanban / Issue Tracker):**
  - Create, assign, update status (`todo`, `in_progress`, `done`), and delete project tasks.
  - Track team progress without leaving the code editor.
- **Collaborative Code Review System:**
  - Submit code review requests on specific files.
  - Add inline review comments, suggest fixes, and mark reviews as Approved or Changes Requested.

### 8. WebRTC Live Voice Calling & Workspace Chat
- **Integrated WebRTC Voice Engine (`useVoiceCall.ts`):**
  - Teacher broadcast / peer mesh voice calling using Socket.io for ICE candidate and SDP exchange.
  - Instant join/leave, mute/unmute microphone, speaking indicators, and live status pills.
- **Real-Time Workspace Chat (`ChatAndVoicePanel`):**
  - Instant messaging with timestamps, user badges, and unread notification alerts.

### 9. Authentication & Granular RBAC
- **Dual Authentication Modes:**
  - **Email & Password:** Secure password hashing with `bcryptjs` and 24h JWT tokens.
  - **Google OAuth 2.0:** One-click Google login using native REST redirects (no external Passport dependencies).
- **Workspace Role Hierarchy:**
  - `owner` / `teacher` / `team_leader` — Full control, invite creation, member role management, session locking.
  - `editor` / `developer` — Can read, write, create files, execute code, and draw on whiteboard.
  - `viewer` / `student` (locked) — Read-only access to files and whiteboard.
- **UUID Invite Links:** Shareable workspace invitation links (`/join?code=<UUID>`) with configurable role defaults, expiration timestamps, and max usage counts.

---

## 🛠️ Tech Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND                                 │
│  React 19  │  TypeScript  │  Vite  │  Tailwind CSS v4  │  Lucide Icons │
│  Socket.io Client  │  Context API  │  WebRTC API  │  Custom Hooks      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ REST & WebSockets (Port 5000)
┌────────────────────────────────────┴───────────────────────────────────┐
│                                BACKEND                                 │
│  Node.js (ESM)  │  Express 4  │  Socket.io 4  │  Sequelize ORM         │
│  SQLite3  │  JWT  │  bcryptjs  │  Google OAuth 2.0  │  Child Process   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Docker CLI Daemon
┌────────────────────────────────────┴───────────────────────────────────┐
│                         EXECUTION SANDBOX                              │
│  Docker Desktop  │  Node 22 Alpine  │ Python 3.12  │ Eclipse Temurin 21│
│  Memory: 512m  │  CPU: 1.0  │  Network: None  │  Workspace Vol Mount   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Directory Structure

```text
CodeSync/
├── package.json                   # Root monorepo orchestration (concurrent dev scripts)
├── README.md                      # Comprehensive project documentation
├── user_workspaces_data/          # Auto-generated isolated storage for user workspaces
│   └── ws-<id>/                   # Workspace physical files and .codesync-meta.json
│
├── backend/                       # Node.js Express & Socket.io backend
│   ├── server.js                  # HTTP server, socket initialization, REST routes
│   ├── package.json               # Backend dependencies and scripts
│   ├── .env.example               # Template environment configuration
│   └── src/
│       ├── config/                # Auth, DB, Docker, and Workspace configs
│       │   ├── authConfig.js      # JWT secrets and expiry
│       │   ├── database.js        # SQLite Sequelize instance
│       │   ├── dockerConfig.js    # Container limits (512m RAM, 1.0 CPU) & image names
│       │   ├── oauthConfig.js     # Google OAuth client credentials
│       │   └── workspaceConfig.js # Timeout thresholds and file size limits
│       ├── controllers/           # Route controllers (Auth, Members, Invites, Files, Whiteboard)
│       ├── middleware/            # JWT auth and RBAC permission guards
│       ├── models/                # Sequelize SQLite models (User, Member, Invite, Whiteboard, Tasks)
│       ├── routes/                # Express API route declarations
│       ├── services/              # Business logic: Docker execution, workspace & disk storage
│       ├── sockets/               # Real-time WebSocket handlers
│       │   ├── workspaceSocket.js # Core IDE collaboration, cursors, chat, voice, tasks
│       │   └── whiteboardSocket.js# Whiteboard canvas element sync and presence
│       └── utils/                 # Path traversal sandbox sanitizers and helpers
│
└── frontend/                      # React 19 + TypeScript + Vite application
    ├── index.html                 # App entry HTML template
    ├── vite.config.ts             # Vite configuration with Tailwind CSS v4
    ├── package.json               # Frontend dependencies and scripts
    └── src/
        ├── App.tsx                # Main view router (Auth -> Dashboard -> IDEShell -> Join)
        ├── main.tsx               # React root renderer
        ├── index.css              # Design system CSS variables (Dark & Light themes)
        ├── types.ts               # Global TypeScript interfaces and role definitions
        ├── components/
        │   ├── auth/              # Login, Registration, and Google OAuth cards
        │   ├── dashboard/         # Workspace grid, creation modal, invite links
        │   ├── ide/               # Full IDE interface
        │   │   ├── IDEShell.tsx   # Core IDE shell: File tree, tabs, editor, expandable console
        │   │   ├── RemoteCursorsOverlay.tsx # Collab cursor rendering and typing indicators
        │   │   ├── ChatAndVoicePanel.tsx    # Slide-out chat and WebRTC voice interface
        │   │   ├── MembersPanel.tsx         # Workspace member list and invite generator
        │   │   ├── LockManagerModal.tsx     # File and line-range locking modal
        │   │   ├── ProfessionalPanel.tsx    # Kanban task board and code review system
        │   │   ├── EnvironmentModal.tsx     # Docker environment monitoring modal
        │   │   └── JoinWorkspacePage.tsx    # Invite link acceptance screen
        │   ├── whiteboard/        # Intelligent collaborative whiteboard system
        │   │   ├── IntelligentWhiteboard.tsx # Whiteboard layout and mode switch
        │   │   ├── WhiteboardCanvas.tsx      # Interactive canvas rendering & pointer events
        │   │   ├── WhiteboardToolbar.tsx     # Shape, tool, and color selectors
        │   │   ├── CommandPalette.tsx        # NLP natural language command box
        │   │   ├── CodeCellNode.tsx          # Executable code snippets on canvas
        │   │   ├── EquationNode.tsx          # Math equation canvas node
        │   │   ├── TextToDiagramModal.tsx    # Text prompt to diagram generator
        │   │   ├── ValidationPanel.tsx       # Flowchart architecture consistency validator
        │   │   └── TaskProposalModal.tsx     # Convert diagram to project tasks
        │   └── ui/                # Reusable UI primitives (Button, Input, Spinner)
        ├── context/               # AuthContext (JWT/OAuth) and ThemeContext (Dark/Light)
        ├── hooks/                 # Custom React hooks
        │   ├── useCodeEditor.ts   # Smart textarea hook (brackets, indentation, shortcuts)
        │   └── useVoiceCall.ts    # WebRTC audio calling hook with Socket.io signaling
        └── services/              # API and WebSocket client services (REST, Collab, Whiteboard)
```

---

## 🚀 Quick Start & Installation

### Prerequisites
1. **Node.js** (v18.0.0 or higher) & **npm**
2. **Docker Desktop** (must be running for code execution sandbox containers)
3. **Git**

---

### One-Command Setup (Parent Directory)

You can install dependencies and run both the Backend and Frontend concurrently with one command from the project root:

```bash
# 1. Clone the repository
git clone https://github.com/anonymous-error404/CodeSync---Collaborative-IDE.git
cd CodeSync---Collaborative-IDE

# 2. Install root dependencies
npm install

# 3. Install backend & frontend dependencies
npm run dev:backend --prefix backend & npm run dev:frontend --prefix frontend
# (Or navigate into backend and frontend separately to run npm install)

# 4. Start both servers concurrently
npm run dev
```

- **Frontend:** `http://localhost:5173`
- **Backend API:** `http://localhost:5000/api`
- **WebSocket Namespace:** `ws://localhost:5000/workspace`
- **Health Check:** `http://localhost:5000/health`

---

### Individual Service Setup

#### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Environment Configuration

### Backend Configuration (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
WORKSPACES_STORAGE_PATH=../user_workspaces_data
JWT_SECRET=codesync_super_secret_jwt_key_2026_collaborative_ide
JWT_EXPIRES_IN=24h
DB_STORAGE=./database.sqlite

# Docker Execution Limits
DOCKER_IMAGE_NODE=node:22-alpine
DOCKER_IMAGE_PYTHON=python:3.12-alpine
DOCKER_IMAGE_JAVA=eclipse-temurin:21-jdk-alpine
DOCKER_MEMORY_LIMIT=512m
DOCKER_CPU_LIMIT=1.0

# Google OAuth 2.0 (Optional for Google login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

### Frontend Configuration (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
```

---

## 🔌 API & WebSocket Reference

### REST API Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create a new user account | Public |
| `POST` | `/api/auth/login` | Authenticate with email & password | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Bearer Token |
| `GET` | `/api/auth/google` | Initiate Google OAuth redirect | Public |
| `GET` | `/api/auth/google/callback` | Exchange OAuth code & return token | Public |
| `GET` | `/api/workspaces` | List user's workspaces | Bearer Token |
| `POST` | `/api/workspaces` | Create a new workspace | Bearer Token |
| `DELETE` | `/api/workspaces/:id` | Delete a workspace and its files | Owner Only |
| `GET` | `/api/workspaces/:id/members` | List members of a workspace | Members |
| `PATCH` | `/api/workspaces/:id/members/:userId` | Update member role | Owner Only |
| `DELETE` | `/api/workspaces/:id/members/:userId` | Remove member from workspace | Owner Only |
| `DELETE` | `/api/workspaces/:id/members/me` | Leave workspace | Members |
| `POST` | `/api/workspaces/:id/invites` | Generate workspace invite link | Owner / Editor |
| `GET` | `/api/workspaces/:id/invites` | List active workspace invites | Members |
| `DELETE` | `/api/workspaces/:id/invites/:inviteId` | Revoke invite link | Owner Only |
| `POST` | `/api/invites/:inviteId/join` | Join workspace via invite code | Bearer Token |
| `PUT` | `/api/workspaces/:id/files/content` | Save file content to disk | Editor / Owner |
| `POST` | `/api/workspaces/:id/files` | Create new file or folder | Editor / Owner |
| `DELETE` | `/api/workspaces/:id/files` | Delete file or folder | Editor / Owner |
| `POST` | `/api/workspaces/:id/files/rename` | Rename file or folder | Editor / Owner |

---

### WebSocket Events (`/workspace` Namespace)

| Event Name | Direction | Payload Description |
|---|---|---|
| `join-workspace` | Client → Server | `{ workspaceId, token }` |
| `workspace-ready` | Server → Client | Initial file tree, member role, session state, and locks |
| `user-joined` / `user-left`| Server → Client | Member presence notifications and socket IDs |
| `file-change` | Client → Server | Broadcast content changes to collaborators |
| `file-updated` | Server → Client | Receives real-time content changes from others |
| `cursor-move` / `cursor-leave` | Bi-directional | Real-time cursor coordinates and typing state |
| `execute-code` | Client → Server | Triggers Docker container execution for the active file |
| `execution-stdout` | Server → Client | Real-time stdout stream chunk from Docker |
| `execution-stderr` | Server → Client | Real-time stderr stream chunk from Docker |
| `execution-exit` | Server → Client | Execution completion status code and runtime duration |
| `stop-execution` | Client → Server | Manually aborts and removes the running Docker container |
| `voice-start` / `voice-stop` | Bi-directional | Teacher/lead initiates or ends WebRTC audio call |
| `voice-signal` | Bi-directional | WebRTC SDP offer/answer and ICE candidate exchange |
| `chatMessage` | Bi-directional | Sends and broadcasts room chat messages |
| `session:lock_all` / `unlock_all`| Client → Server | Teacher locks or unlocks all student editors |
| `session:focus` | Client → Server | Teacher forces all students to open a specific file |
| `session:raise_hand` | Client → Server | Student requests instructor attention |
| `lock:create` / `lock:release` | Bi-directional | Granular file and line-range locking coordination |
| `whiteboard:elements-change` | Bi-directional | Broadcasts canvas diagram updates in real-time |

---

## 🛡️ Security & Sandboxing Architecture

1. **Path Traversal Protection (`pathSandbox.js`):**
   - All file and directory operations are verified using absolute canonical path resolution. Any attempt to traverse above the workspace root (`../`) throws an immediate security exception.
2. **Docker Isolation:**
   - Code runs inside ephemeral Linux Alpine containers.
   - Network access is disabled (`--network none`) to prevent SSRF attacks, unauthorized network requests, or reverse shells.
   - Strict memory (`512MB`) and CPU (`1.0`) quotas prevent denial-of-service from fork bombs or memory exhaustion.
3. **RBAC & Role Verification:**
   - Every file change, whiteboard stroke, and code execution request verifies the user's JWT token and workspace membership role before execution. Viewers and locked students cannot modify files or execute code.
4. **Persistent Workspace Metadata:**
   - Each workspace writes a `.codesync-meta.json` file inside `user_workspaces_data/ws-<id>/`. Even if the server restarts, all workspace structures and files are preserved.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project repository.
2. Create your feature branch (`git checkout -b feature/NewFeature`).
3. Commit your changes (`git commit -m 'feat: Add NewFeature'`).
4. Push to the branch (`git push origin feature/NewFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the **ISC License**.
