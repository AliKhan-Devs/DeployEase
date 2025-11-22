
import { createLogger } from "../createLogger";
import { EC2Client } from "@aws-sdk/client-ec2";
import { createEc2Instance } from "./EC2_Instance";
import { performDeployment } from "./performDeployment";
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();



export async function handleDeploymentRequest({ session, body,log }) {
    const {
      accessKeyId,
      secretAccessKey,
      region,
      instanceType,
      repoName,
      repoUrl,
      branch = "main",
      port = "3000",
      mainfile = "index.js",
      env = "",
      appType = "node",
      repoSubPath = "",
      autoDeploy = false,
      targetInstanceId = null,
    } = body;
    const userId = session.user.id;
  
    if (!repoName || !repoUrl) {
      return new Response(JSON.stringify({ error: "Repository name and URL are required." }), { status: 400 });
    }
  
    if (!region && !targetInstanceId) {
      return new Response(JSON.stringify({ error: "AWS region is required for new instances." }), { status: 400 });
    }
  
    
    await log("🚀 Starting deployment workflow...");
  
    let instanceRecord = null;
    let privateKey = null;
    let ec2Client = null;
    let credentials = { accessKeyId, secretAccessKey };
  
    if (targetInstanceId) {
      instanceRecord = await prisma.ec2Instance.findFirst({
        where: { id: targetInstanceId, userId },
      });
      if (!instanceRecord) {
        return new Response(JSON.stringify({ error: "Instance not found or access denied." }), { status: 404 });
      }
      credentials = {
        accessKeyId: decryptSecret(instanceRecord.accessKeyId),
        secretAccessKey: decryptSecret(instanceRecord.secretAccessKey),
      };
      ec2Client = new EC2Client({
        region: instanceRecord.region,
        credentials,
      });
      await log(`♻️ Reusing existing EC2 instance (${instanceRecord.awsInstanceId})`);
    } else {
      if (!accessKeyId || !secretAccessKey || !region) {
        return new Response(JSON.stringify({ error: "AWS credentials and region are required to provision a new instance." }), {
          status: 400,
        });
      }
      ec2Client = new EC2Client({
        region,
        credentials,
      });
      const created = await createEc2Instance({
        ec2Client,
        userId,
        region,
        instanceType,
        log,
        accessKeyId,
        secretAccessKey,
      });
      instanceRecord = created.instanceRecord;
      privateKey = created.privateKey;
    }
  
    try {
      await log("⚙️ Provisioning application on instance...");
      const result = await performDeployment({
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
        isRedeploy: false,
        existingDeployment: null,
      });
  
      const deployment = await prisma.deployment.create({
        data: {
          user: { connect: { id: userId } },
          instance: { connect: { id: instanceRecord.id } },
          repoName,
          repoUrl,
          branch,
          status: "SUCCESS",
          ec2InstanceId: instanceRecord.awsInstanceId,
          ec2PublicIp: instanceRecord.publicIp,
          keyPairName: instanceRecord.keyPairName,
          keyMaterial: instanceRecord.keyMaterial,
          appType,
          appDirectory: result.appDir,
          repoPath: result.repoDir,
          appPort: result.appPort,
          exposedUrl: result.exposedUrl,
          envVars: env,
          autoDeploy: result.autoDeploy,
          repoSubPath: result.repoSubPath,
          slug: result.slug,
          entryPoint: result.entryPoint,
        },
      });
  
      await log("✅ Deployment saved successfully");
      const responsePayload = {
        success: true,
        message: "Deployment completed successfully.",
        instanceId: instanceRecord.awsInstanceId,
        publicIp: instanceRecord.publicIp,
        keyPairName: instanceRecord.keyPairName,
        privateKey: privateKey || undefined,
        deployment,
      };
  
      return new Response(JSON.stringify(responsePayload), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      await log(`❌ Deployment error: ${err.message || err}`);
      await prisma.deployment.create({
        data: {
          user: { connect: { id: userId } },
          instance: instanceRecord ? { connect: { id: instanceRecord.id } } : undefined,
          repoName,
          repoUrl,
          branch,
          status: "FAILED",
          logs: String(err.stack || err.message || err),
        },
      }).catch(() => { });
      return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
    }
  }
  