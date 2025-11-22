import { escapeDoubleQuotes } from "../helpers";

export async function configurePythonApp({ ssh, repoDir, appDir, mainfile, slug, port, log }) {
    await log("📦 Installing Python requirements...");
    await ssh.execCommand(
      `bash -lc 'set -e; cd "${repoDir}"; if [ -f requirements.txt ]; then pip3 install -r requirements.txt; fi'`
    );
  
    const safeMain = escapeDoubleQuotes(mainfile);
    const startScript = `
  if pm2 describe "${slug}" >/dev/null 2>&1; then
    pm2 delete "${slug}"
  fi
  if [ -f "${appDir}/app.py" ]; then
    PORT=${port} pm2 start app.py --name "${slug}" --cwd "${appDir}" --interpreter python3 --update-env
  elif [ -f "${appDir}/main.py" ]; then
    PORT=${port} pm2 start main.py --name "${slug}" --cwd "${appDir}" --interpreter python3 --update-env
  elif [ -f "${appDir}/${safeMain}" ]; then
    PORT=${port} pm2 start "${safeMain}" --name "${slug}" --cwd "${appDir}" --interpreter python3 --update-env
  else
    PORT=${port} pm2 start python3 --name "${slug}" -- app.py
  fi
  pm2 save || true
  `;
  
    await log("▶️ Starting Python app with PM2...");
    await ssh.execCommand(`bash -lc 'set -e; ${startScript.trim()}'`);
  }