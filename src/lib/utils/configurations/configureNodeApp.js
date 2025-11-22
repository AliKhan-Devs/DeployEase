import { escapeDoubleQuotes } from "../helpers";

const NODE_APP_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"];



export async function configureNodeApp({ ssh, repoDir, appDir, mainfile, slug, port, log }) {
    await log("📦 Installing Node.js dependencies...");
    await ssh.execCommand(
      `bash -lc 'set -e; cd "${repoDir}"; if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi'`
    );
  
    const safeMain = escapeDoubleQuotes(mainfile);
    const hasFileEntry = NODE_APP_EXTENSIONS.some((ext) => safeMain.endsWith(ext));
    const startScript = hasFileEntry
      ? `
  if pm2 describe "${slug}" >/dev/null 2>&1; then
    pm2 delete "${slug}"
  fi
  PORT=${port} pm2 start "${safeMain}" --name "${slug}" --cwd "${appDir}" --update-env
  `
      : `
  if pm2 describe "${slug}" >/dev/null 2>&1; then
    pm2 delete "${slug}"
  fi
  PORT=${port} pm2 start npm --name "${slug}" --cwd "${appDir}" -- start
  `;
  
    await log("▶️ Starting Node app with PM2...");
    await ssh.execCommand(
      `bash -lc 'set -e; cd "${appDir}"; ${startScript.trim()}; pm2 save'`
    );
  }