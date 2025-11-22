
import { NodeSSH } from "node-ssh";
import { createLogger } from "./createLogger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APP_BASE_DIR = "/home/ubuntu/apps";

 



export function slugifyName(value = "") {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "app";
  }
  
  export function escapeDoubleQuotes(value = "") {
    return value.replace(/(["\\$`])/g, "\\$1");
  }
  
  export function sanitizeSubPath(pathValue = "") {
    const trimmed = pathValue.trim().replace(/^\/+|\/+$/g, "");
    if (!trimmed) return "";
    if (trimmed.includes("..")) {
      throw new Error("Subdirectory path cannot traverse up the repository tree.");
    }
    return trimmed;
  }
  
  export function buildIpPermissions(ports = []) {
    return ports.map((p) => ({
      IpProtocol: "tcp",
      FromPort: p,
      ToPort: p,
      IpRanges: [{ CidrIp: "0.0.0.0/0" }],
    }));
  }
  
  export function buildAppPaths(slug, repoSubPath) {
    const baseDir = `${APP_BASE_DIR}/${slug}`;
    const repoDir = `${baseDir}/repo`;
    const cleanedSubPath = sanitizeSubPath(repoSubPath);
    const appDir = cleanedSubPath ? `${repoDir}/${cleanedSubPath}` : repoDir;
    return { baseDir, repoDir, appDir, repoSubPath: cleanedSubPath };
  }

  export async function installStack({ ssh, appType, log }) {
    const run = async (cmd) => {
      const result = await ssh.execCommand(cmd, {
        onStdout(chunk) {
          if (chunk.toString().trim()) log(chunk.toString());
        },
        onStderr(chunk) {
          if (chunk.toString().trim()) log(chunk.toString());
        },
      });
  
      if (result.code !== 0) {
        throw new Error(`Command failed: ${cmd} → ${result.stderr}`);
      }
    };
  
    await log("📦 Updating system packages...");
    await run(`sudo apt update -y`);
  
    // ----------------------------
    // NODE + REACT STACK
    // ----------------------------
    if (appType === "node" || appType === "react") {
      await log("📦 Installing git & curl...");
      await run(`sudo apt install -y git curl`);
  
      await log("🧹 Removing older Node/npm (if exists)...");
      await run(`sudo apt purge -y nodejs npm || true`);
  
      await log("📥 Installing NodeSource 20.x...");
      await run(
        `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -`
      );
  
      await log("📥 Installing Node.js 20.x...");
      await run(`sudo apt install -y nodejs`);
  
      await log("🔥 Installing PM2 globally...");
      await run(`sudo npm install -g pm2`);
  
      await log("🌐 Installing Nginx...");
      await run(`sudo apt install -y nginx`);
  
      await log("🔍 Verifying versions...");
      await run(`node -v`);
      await run(`npm -v`);
      await run(`pm2 -v`);
      await run(`nginx -v`);
  
      return;
    }
  
    // ----------------------------
    // PYTHON STACK
    // ----------------------------
    if (appType === "python") {
      await log("📦 Installing Python environment, git, curl...");
  
      await run(`
        sudo apt install -y git python3 python3-pip curl
      `);
  
      await log("📥 Installing Node.js (for PM2)...");
      await run(`sudo apt purge -y nodejs npm || true`);
      await run(
        `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -`
      );
      await run(`sudo apt install -y nodejs`);
  
      await log("🔥 Installing PM2...");
      await run(`sudo npm install -g pm2`);
  
      await log("🌐 Installing Nginx...");
      await run(`sudo apt install -y nginx`);
  
      await log("🔍 Verifying versions...");
      await run(`python3 --version`);
      await run(`pip3 --version`);
      await run(`pm2 -v`);
      await run(`nginx -v`);
  
      return;
    }
  
    // ----------------------------
    // STATIC DEPLOYMENT STACK
    // ----------------------------
    if (appType === "static") {
      await log("📦 Installing git & nginx...");
      await run(`sudo apt install -y git nginx`);
  
      await log("🔍 Verifying Nginx...");
      await run(`nginx -v`);
      return;
    }
  
    throw new Error(`Unsupported app type: ${appType}`);
  }

  export async function syncRepository({ ssh, repoDir, repoUrl, branch, isRedeploy, log }) {
    const safeRepoUrl = escapeDoubleQuotes(repoUrl);
    const safeBranch = escapeDoubleQuotes(branch);
    await ssh.execCommand(`mkdir -p ${APP_BASE_DIR}`);
  
    if (!isRedeploy) {
      await log(`📂 Cloning repository ${repoUrl} (branch: ${branch})`);
      await ssh.execCommand(`rm -rf ${repoDir}`);
      await ssh.execCommand(
        `git clone -b "${safeBranch}" "${safeRepoUrl}" "${repoDir}"`
      );
    } else {
      await log("📂 Updating repository with latest changes...");
      const check = await ssh.execCommand(`[ -d "${repoDir}/.git" ] && echo "1" || echo "0"`);
      if (check.stdout.trim() !== "1") {
        await log("ℹ️ Repository missing on instance. Re-cloning from origin...");
        await ssh.execCommand(`rm -rf ${repoDir}`);
        await ssh.execCommand(
          `git clone -b "${safeBranch}" "${safeRepoUrl}" "${repoDir}"`
        );
      } else {
        await ssh.execCommand(`git -C "${repoDir}" fetch --all`);
        await ssh.execCommand(`git -C "${repoDir}" checkout "${safeBranch}"`);
        await ssh.execCommand(`git -C "${repoDir}" reset --hard "origin/${safeBranch}"`);
      }
    }
  }

  export async function writeEnvFile({ ssh, appDir, env, log }) {
    if (!env || !env.trim()) return;
    await log("🧾 Writing .env file");
    await ssh.execCommand(
      `bash -lc 'cat <<'EOF' > "${appDir}/.env"\n${env.replace(/\r\n/g, "\n")}\nEOF'`
    );
  }

  export async function handleEnvUpdate({ session, body,log }) {
   const userId = session.user.id;
    const { deploymentId, env = "" } = body;
    if (!deploymentId) {
      return new Response(JSON.stringify({ error: "deploymentId is required for env updates." }), { status: 400 });
    }
  
    const deployment = await prisma.deployment.findFirst({
      where: { id: deploymentId, userId: session.user.id },
      include: { instance: true },
    });
  
    if (!deployment || !deployment.instance) {
      return new Response(JSON.stringify({ error: "Deployment not found." }), { status: 404 });
    }
  
   
    await log("🔄 Updating environment variables...");
  
    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host: deployment.instance.publicIp,
        username: deployment.instance.sshUsername || "ubuntu",
        privateKey: decryptSecret(deployment.instance.keyMaterial),
      });
      await writeEnvFile({ ssh, appDir: deployment.appDirectory, env, log });
  
      if (deployment.appType === "node" || deployment.appType === "python") {
        await log("♻️ Restarting PM2 process to apply new env vars...");
        await ssh.execCommand(`bash -lc 'pm2 restart "${deployment.slug}" --update-env || true'`);
        await ssh.execCommand(`bash -lc 'pm2 save || true'`);
      }
  
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { envVars: env, updatedAt: new Date() },
      });
  
      await log("✅ Environment updated successfully");
      return new Response(JSON.stringify({ success: true, message: "Environment updated." }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      await log(`❌ Failed to update environment: ${err.message || err}`);
      return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
    } finally {
      try {
        ssh.dispose();
      } catch (err) { }
    }
  }
  

  export function defaultEntryPoint(appType) {
    switch (appType) {
      case "node":
        return "index.js";
      case "python":
        return "app.py";
      default:
        return "";
    }
  }