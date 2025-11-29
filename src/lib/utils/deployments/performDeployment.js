import { NodeSSH } from "node-ssh";
import { decryptSecret } from "../encryptDecrypt.js";
import { buildAppPaths, defaultEntryPoint, installStack, slugifyName, syncRepository, writeEnvFile } from "../helpers.js";
import { ensureNginxBase, writeNginxLocation } from "../nginxSetup.js";
import { configureNodeApp } from "../configurations/configureNodeApp.js";
import { configureReactApp } from "../configurations/configureReactApp.js";
import { configurePythonApp } from "../configurations/configurePythonApp.js";



async function waitForSSH(ssh, host, username, privateKey, log) {
  const maxRetries = 20;
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let i = 1; i <= maxRetries; i++) {
    try {
      await log(`⏳ Waiting for SSH... attempt ${i}`);
      await ssh.connect({
        host,
        username,
        privateKey,
      });
      await log("🔑 SSH is ready!");
      return;
    } catch (err) {
      await delay(5000); // Wait 5 seconds
    }
  }

  throw new Error("SSH not ready after multiple attempts");
}



export async function performDeployment({
  instanceRecord,
  repoName,
  repoUrl,
  branch,
  appType,
  mainfile,
  port,
  env,
  repoSubPath,
  autoDeploy,
  log,
  isRedeploy = false,
  existingDeployment = null,
}) {
  const ssh = new NodeSSH();
  const decryptedKey = decryptSecret(instanceRecord.keyMaterial);

  try {
    await log("🔑 Connecting to instance via SSH...");

    await ssh.connect({
      host: instanceRecord.publicIp,
      username: instanceRecord.sshUsername || "ubuntu",
      privateKey: decryptedKey,
    });
    await log("⏳ Waiting for SSH service to be ready...");
    
    await waitForSSH(
      ssh,
      instanceRecord.publicIp,
      instanceRecord.sshUsername || "ubuntu",
      decryptedKey,
      log
    );

    await log("🔑 SSH connection established.");

    await installStack({ ssh, appType, log });
    await ensureNginxBase(ssh);

    const slug =
      `${slugifyName(repoName || "app")}-${crypto.randomUUID().slice(0, 8)}`;
    const numericalPort = Number(port) || existingDeployment?.appPort || (appType === "python" ? 8000 : 3000);
    const entryPoint = mainfile || existingDeployment?.entryPoint || defaultEntryPoint(appType);

    const { baseDir, repoDir, appDir, repoSubPath: cleanedSubPath } = buildAppPaths(slug, repoSubPath || existingDeployment?.repoSubPath || "");

    await ssh.execCommand(`mkdir -p "${baseDir}"`);

    await syncRepository({
      ssh,
      repoDir,
      repoUrl,
      branch,
      isRedeploy,
      log,
    });

    await ssh.execCommand(`mkdir -p "${appDir}"`);
    await writeEnvFile({ ssh, appDir, env, log });

    if (appType === "node") {
      await configureNodeApp({ ssh, repoDir: appDir, appDir, mainfile: entryPoint, slug, port: numericalPort, log });
      await writeNginxLocation({ ssh, slug, appType, appPort: numericalPort });
    } else if (appType === "react") {
      await configureReactApp({ ssh, repoDir: appDir, slug, log });
      await writeNginxLocation({ ssh, slug, appType, staticRoot: `/var/www/${slug}` });
    } else if (appType === "python") {
      await configurePythonApp({ ssh, repoDir: appDir, appDir, mainfile: entryPoint, slug, port: numericalPort, log });
      await writeNginxLocation({ ssh, slug, appType, appPort: numericalPort });
    } else if (appType === "static") {
      await configureStaticApp({ ssh, repoDir, slug, log, appDir });
      await writeNginxLocation({ ssh, slug, appType, staticRoot: `/var/www/${slug}` });
    } else {
      throw new Error(`Unsupported app type: ${appType}`);
    }

    const exposedUrl = `http://${instanceRecord.publicIp}/${slug}/`;

    return {
      slug,
      repoDir,
      appDir,
      repoSubPath: cleanedSubPath,
      appPort: numericalPort,
      exposedUrl,
      autoDeploy: Boolean(autoDeploy),
      entryPoint,
    };
  } finally {
    try {
      ssh.dispose();
    } catch (err) {
      console.warn("Failed to dispose SSH connection", err);
    }
  }
}
