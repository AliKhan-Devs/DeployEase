import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { performDeployment, createLogger, defaultEntryPoint } from "@/app/api/deploy/route";

const prisma = new PrismaClient();

function verifySignature(payload, signature, secret) {
  if (!secret) return true;
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const digest = `sha256=${hmac.digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (err) {
    return false;
  }
}

export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "";
  if (!verifySignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const eventType = req.headers.get("x-github-event");
  if (eventType !== "push") {
    return new Response(JSON.stringify({ skipped: true, reason: "Unsupported event type" }), { status: 202 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const branchRef = payload.ref;
  const repoUrl = payload.repository?.html_url;
  if (!branchRef || !repoUrl) {
    return new Response("Missing repository data", { status: 400 });
  }

  const branch = branchRef.replace("refs/heads/", "");

  const deployments = await prisma.deployment.findMany({
    where: {
      repoUrl,
      branch,
      autoDeploy: true,
    },
    include: { instance: true, user: true },
  });

  if (!deployments.length) {
    return new Response(JSON.stringify({ matched: 0 }), { status: 200 });
  }

  const results = [];

  for (const deployment of deployments) {
    if (!deployment.instance) {
      results.push({ deploymentId: deployment.id, status: "skipped", reason: "Missing instance" });
      continue;
    }

    const log = createLogger(deployment.userId || deployment.user?.id || "");
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "RUNNING", updatedAt: new Date() },
    });

    try {
      const result = await performDeployment({
        instanceRecord: deployment.instance,
        repoName: deployment.repoName,
        repoUrl: deployment.repoUrl,
        branch: deployment.branch,
        appType: deployment.appType,
        mainfile: deployment.entryPoint || defaultEntryPoint(deployment.appType),
        port: deployment.appPort,
        env: deployment.envVars,
        repoSubPath: deployment.repoSubPath,
        autoDeploy: true,
        log,
        isRedeploy: true,
        existingDeployment: deployment,
      });

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "SUCCESS",
          appPort: result.appPort,
          exposedUrl: result.exposedUrl,
          updatedAt: new Date(),
        },
      });
      results.push({ deploymentId: deployment.id, status: "success" });
    } catch (err) {
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "FAILED",
          logs: String(err.stack || err.message || err),
          updatedAt: new Date(),
        },
      }).catch(() => {});
      await log(`❌ Auto-deploy failed: ${err.message || err}`);
      results.push({ deploymentId: deployment.id, status: "failed", error: err.message || String(err) });
    }
  }

  return new Response(JSON.stringify({ matched: deployments.length, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

