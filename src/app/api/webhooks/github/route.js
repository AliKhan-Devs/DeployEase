import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { performDeployment, createLogger } from "@/app/api/deploy/route";
import { defaultEntryPoint } from "@/lib/utils/helpers";

const prisma = new PrismaClient();

function verifySignature(payload, signature, secret) {
  if (!secret || !signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const digest = `sha256=${hmac.digest("hex")}`;

  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signature, "utf8");

  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(expected, received);
}

export async function POST(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // Never process webhook events without a configured signing secret.
  if (!secret) {
    console.error("GITHUB_WEBHOOK_SECRET is not configured");
    return new Response("Webhook signing is not configured", { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const eventType = req.headers.get("x-github-event");
  if (eventType !== "push") {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Unsupported event type" }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
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
    return new Response(JSON.stringify({ matched: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = [];

  for (const deployment of deployments) {
    if (!deployment.instance) {
      results.push({
        deploymentId: deployment.id,
        status: "skipped",
        reason: "Missing instance",
      });
      continue;
    }

    const log = createLogger(deployment.userId || deployment.user?.id || "");

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "RUNNING", updatedAt: new Date() },
    });

    try {
      // Check deployment type: EC2 or S3
      const deploymentType = deployment.deploymentType || "ec2";

      if (deploymentType === "s3") {
        // S3 deployment
        if (!deployment.user?.awsAccessKeyId || !deployment.user?.awsSecretAccessKey) {
          results.push({ 
            deploymentId: deployment.id, 
            status: "skipped", 
            reason: "Missing AWS credentials for S3 deployment" 
          });
          continue;
        }

        const { deployToS3 } = await import("@/lib/utils/deployments/deployToS3");
        
        const result = await deployToS3({
          accessKeyId: deployment.user.awsAccessKeyId,
          secretAccessKey: deployment.user.awsSecretAccessKey,
          region: deployment.s3Region || "us-east-1",
          repoUrl: deployment.repoUrl,
          branch: deployment.branch,
          repoName: deployment.repoName,
          buildCommand: deployment.buildCommand || null,
          outputDirectory: deployment.outputDirectory || null,
          log,
          bucketName: deployment.s3BucketName || null,
        });

        await prisma.deployment.update({
          where: { id: deployment.id },
          data: {
            status: "SUCCESS",
            s3BucketName: result.bucketName,
            s3Region: result.region,
            s3WebsiteUrl: result.websiteUrl,
            exposedUrl: result.websiteUrl,
            updatedAt: new Date(),
          },
        });
        results.push({ deploymentId: deployment.id, status: "success", type: "s3" });
      } else {
        // EC2 deployment
        if (!deployment.instance) {
          results.push({ 
            deploymentId: deployment.id, 
            status: "skipped", 
            reason: "Missing instance for EC2 deployment" 
          });
          continue;
        }

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
        results.push({ deploymentId: deployment.id, status: "success", type: "ec2" });
      }
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
      await prisma.deployment
        .update({
          where: { id: deployment.id },
          data: {
            status: "FAILED",
            logs: String(err.stack || err.message || err),
            updatedAt: new Date(),
          },
        })
        .catch(() => {});

      await log(`❌ Auto-deploy failed: ${err.message || err}`);
      results.push({
        deploymentId: deployment.id,
        status: "failed",
        error: err.message || String(err),
      });
    }
  }

  return new Response(JSON.stringify({ matched: deployments.length, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
