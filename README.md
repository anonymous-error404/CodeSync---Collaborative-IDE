# CodeSync — Collaborative Web-Based IDE

CodeSync is a real-time collaborative development environment that allows users to create workspaces, manage files, and execute code in isolated Docker containers directly from the browser. It features a modern, sleek UI inspired by popular IDEs like VS Code and StackBlitz.

## ✨ Features

- **Secure Authentication:** JWT-based user login and registration system.
- **Workspace Management:** Create isolated workspaces. Workspace metadata and files are persistently stored.
- **Smart Code Editor:** Custom-built React IDE interface featuring:
  - Auto-closing brackets and quotes `(), [], {}, "", ''`
  - Smart indentation based on language (e.g., auto-indent after Python colons `:` or JavaScript curly braces `{`)
  - Multi-tab support and unsaved file indicators (●)
  - Keyboard shortcuts (e.g., `Ctrl+S` or `Cmd+S` to save)
- **Real-Time File System:** Create, rename, delete, and save files. File tree and content sync in real-time via WebSockets.
- **Isolated Code Execution:** Run your code securely. The backend spins up ephemeral Docker containers to execute:
  - **JavaScript** (Node.js)
  - **Python** (Python 3.12)
  - **Java** (Eclipse Temurin JDK 21)
  - *Note: Execution streams stdout and stderr live to the frontend console.*
- **Modern UI:** Responsive, sleek UI with Light and Dark themes, built with Tailwind CSS v4 and Lucide icons.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS v4
- **State & Real-time:** Context API, `socket.io-client`
- **Icons:** Lucide React

### Backend
- **Server:** Node.js, Express
- **Real-time Engine:** Socket.io
- **Database:** SQLite (via Sequelize ORM)
- **Authentication:** bcryptjs, jsonwebtoken
- **Execution Engine:** Docker Desktop

---

## 🚀 Getting Started

### Prerequisites
1. **Node.js** (v18 or higher)
2. **Docker Desktop** (must be installed and running for the code execution engine to work)

### 1. Backend Setup
Navigate to the `backend` directory, install dependencies, and start the server:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory (you can copy from `.env.example`):
```env
PORT=5000
NODE_ENV=development
WORKSPACES_STORAGE_PATH=../user_workspaces_data
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=24h
DB_STORAGE=./database.sqlite

# Docker Execution Images
DOCKER_IMAGE_NODE=node:22-alpine
DOCKER_IMAGE_PYTHON=python:3.12-alpine
DOCKER_IMAGE_JAVA=eclipse-temurin:21-jdk-alpine
DOCKER_MEMORY_LIMIT=128m
DOCKER_CPU_LIMIT=0.5
```

Start the backend server:
```bash
npm run dev
```
*(The backend runs on `http://localhost:5000` and will automatically pull required Docker images on first run).*

### 2. Frontend Setup
Open a new terminal, navigate to the `frontend` directory, and install dependencies:

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:5000
```

Start the frontend development server:
```bash
npm run dev
```
*(The frontend will be available at `http://localhost:5173` or similar).*

---

## 📂 Project Structure

```text
CodeSync/
├── backend/
│   ├── src/
│   │   ├── config/        # Environment, Docker, Workspace limits
│   │   ├── controllers/   # Express route controllers
│   │   ├── middleware/    # JWT Auth middleware
│   │   ├── models/        # Sequelize SQLite models (User)
│   │   ├── routes/        # API endpoints (Auth, Workspaces)
│   │   ├── services/      # Core logic (Storage, Execution, Workspaces)
│   │   └── sockets/       # Socket.io event handlers
│   ├── test/              # Integration and unit tests
│   └── server.js          # Express & Socket.io entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/    # UI Components (Auth, Dashboard, IDE, shared UI)
│   │   ├── context/       # React Context (Auth, Theme)
│   │   ├── hooks/         # Custom hooks (useCodeEditor)
│   │   ├── services/      # API client wrappers
│   │   └── index.css      # CSS variables for Light/Dark themes
│   ├── vite.config.ts     # Vite & Tailwind v4 configuration
│   └── package.json
│
└── user_workspaces_data/  # Auto-generated. Stores physical user files and metadata.
```

---

## 🔧 Architecture & Data Flow

1. **REST API:** Used for authentication, listing workspaces, creating workspaces, and fetching initial file content.
2. **WebSockets (/workspace namespace):**
   - **File Sync:** Sends file updates (`file-change`) and filesystem events (`fs-action`).
   - **Execution:** When the user clicks "Run", the client emits `execute-code`. The backend launches a short-lived Docker container, mounts the workspace directory, executes the file based on its extension, and streams `execution-stdout` and `execution-stderr` back to the client.
3. **Persistence:** Workspaces write a hidden `.codesync-meta.json` file inside their respective folder in `user_workspaces_data/`. If the backend restarts, it scans this directory to seamlessly restore user workspaces.

---

## 🤝 Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
