// --------------------------
// Deploy React App

import { writeNginxLocation } from "../nginxSetup";

// --------------------------
export async function configureReactApp({ ssh, repoDir, slug, log }) {
    await log("📦 Installing React dependencies & building...");
  
    // 0) Ensure package.json exists
    const checkPkg = await ssh.execCommand(`bash -lc '[ -f "${repoDir}/package.json" ] && echo "1" || echo "0"'`);
    if (checkPkg.stdout.trim() !== "1") {
      throw new Error(`package.json not found in ${repoDir}. Did you set the correct repoSubPath?`);
    }
  
    const streamExec = (cmd) =>
      ssh.execCommand(cmd, {
        cwd: repoDir,
        onStdout(chunk) { if (chunk && chunk.toString) log(chunk.toString().trim()); },
        onStderr(chunk) { if (chunk && chunk.toString) log(chunk.toString().trim()); },
      });
  
    // 1) Install dependencies
    await log("📥 Installing dependencies...");
    const hasLock = (await ssh.execCommand(`bash -lc '[ -f "${repoDir}/package-lock.json" ] && echo "1" || echo "0"'`)).stdout.trim() === "1";
    const installCmd = hasLock
      ? `bash -lc 'CI=false npm ci --no-audit --no-fund --loglevel=warn --progress=false'`
      : `bash -lc 'CI=false npm install --no-audit --no-fund --loglevel=warn --progress=false'`;
    const installRes = await streamExec(installCmd);
    if (installRes.code !== 0) throw new Error(`npm install failed (exit ${installRes.code})`);
    await log("✅ Dependencies installed.");
  
    // 2) Build
    await log("🔨 Building React app...");
    const buildCmd = `bash -lc 'CI=false BROWSER=none NODE_OPTIONS="--max-old-space-size=2048" npm run build --if-present --loglevel=warn'`;
    const buildRes = await streamExec(buildCmd);
    if (buildRes.code !== 0) throw new Error(`npm run build failed (exit ${buildRes.code})`);
    await log("✅ Build completed.");
  
    // 3) Detect build folder
    const detectRes = await streamExec(`
      if [ -d "${repoDir}/build" ]; then echo "build";
      elif [ -d "${repoDir}/dist" ]; then echo "dist";
      else echo "none"; fi
    `);
    const outputDir = detectRes.stdout.trim();
    if (outputDir === "none") throw new Error("❌ No build output found (expected build/ or dist/).");
    await log(`📁 Build output folder: ${outputDir}/`);
  
    // 4) Publish to /var/www/<slug>
    const webRoot = `/var/www/${slug}`;
    await streamExec(`
      sudo mkdir -p ${webRoot};
      sudo rm -rf ${webRoot}/*;
      sudo cp -r ${repoDir}/${outputDir}/* ${webRoot}/;
      sudo chown -R www-data:www-data ${webRoot};
    `);
    await log("✅ Build published.");
  
    // 5) Write Nginx config
    await writeNginxLocation({ ssh, slug, appType: "react", staticRoot: webRoot });
  
    await log("🚀 React app deployed and Nginx configured successfully!");
  }
  