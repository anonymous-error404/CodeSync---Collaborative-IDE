import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// workspace storage root path from environment variable or default relative path
const rawStoragePath =
  process.env.WORKSPACES_STORAGE_PATH || "../user_workspaces_data";
const STORAGE_ROOT = path.resolve(__dirname, "../../", rawStoragePath);

// Ensure the storage root directory exists
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  console.log(
    `[Workspace System] Created external storage root at: ${STORAGE_ROOT}`,
  );
} else {
  console.log(
    `[Workspace System] External storage root initialized at: ${STORAGE_ROOT}`,
  );
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const EXECUTION_TIMEOUT_MS = 30000;
const DEFAULT_FILES = {
  "index.js": `// Welcome to your isolated workspace!\nconsole.log("Hello from server workspace!");\n`,
  "README.md": `# Collaborative Workspace\n\nThis workspace is hosted and executed on the backend server.\n`,
};

export { STORAGE_ROOT, MAX_FILE_SIZE_BYTES, EXECUTION_TIMEOUT_MS, DEFAULT_FILES };
