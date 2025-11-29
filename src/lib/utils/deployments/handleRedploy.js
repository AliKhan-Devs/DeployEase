
import { createLogger } from "../createLogger";
import { performDeployment } from "./performDeployment";
import { defaultEntryPoint } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function handleRedeploy({ session, body, log }) {
  const userId = session.user.id;
    const { deploymentId, env, port, mainfile } = body;
    if (!deploymentId) {
      return new Response(JSON.stringify({ error: "deploymentId is required for redeployments." }), { status: 400 });
    }
  
    const deployment = await prisma.deployment.findFirst({
      where: { id: deploymentId, userId: session.user.id },
      include: { instance: true },
    });
  
    if (!deployment || !deployment.instance) {
      return new Response(JSON.stringify({ error: "Deployment not found." }), { status: 404 });
    }

    await log("🔁 Redeploying application with latest code...");
  
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "RUNNING", updatedAt: new Date() },
    });
  
    try {
      const resolvedEntryPoint = mainfile || deployment.entryPoint || defaultEntryPoint(deployment.appType);
      const resolvedPort = port || deployment.appPort;
      const resolvedEnv = typeof env === "string" ? env : deployment.envVars || "";
  
      const result = await performDeployment({
        instanceRecord: deployment.instance,
        repoName: deployment.repoName,
        repoUrl: deployment.repoUrl,
        branch: deployment.branch,
        appType: deployment.appType,
        mainfile: resolvedEntryPoint,
        port: resolvedPort,
        env: resolvedEnv,
        repoSubPath: deployment.repoSubPath,
        autoDeploy: deployment.autoDeploy,
        log,
        isRedeploy: true,
        existingDeployment: deployment,
      });
  
      const updatedDeployment = await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "SUCCESS",
          envVars: resolvedEnv,
          appPort: result.appPort,
          exposedUrl: result.exposedUrl,
          entryPoint: result.entryPoint,
          updatedAt: new Date(),
        },
      });
  
      await log("✅ Redeploy completed.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Redeployment completed.",
          deployment: updatedDeployment,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: "FAILED", logs: String(err.stack || err.message || err) },
      }).catch(() => { });
      await log(`❌ Redeploy error: ${err.message || err}`);
      return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
    }
  }
  