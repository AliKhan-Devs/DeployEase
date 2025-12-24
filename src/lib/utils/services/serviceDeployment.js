/**
 * Service Deployment Orchestrator
 * 
 * Handles deployment of individual services within a multi-service deployment
 */

import { PrismaClient } from "@prisma/client";
import { performDeployment } from "../deployments/performDeployment.js";
import { deployToS3 } from "../deployments/deployToS3.js";
import { ensureTargetGroup, registerTarget, allocatePort } from "./serviceInfrastructure.js";
import { getVpcIdFromInstance } from "./serviceInfrastructure.js";
import { EC2Client } from "@aws-sdk/client-ec2";
import { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import { decryptSecret } from "../encryptDecrypt.js";

const prisma = new PrismaClient();

/**
 * Deploy a single service
 * @param {Object} params - Deployment parameters
 * @returns {Promise<Service>} - Deployed service record
 */
export async function deployService({
  serviceConfig,
  instanceRecord,
  repoUrl,
  branch,
  repoName,
  userId,
  credentials,
  region,
  log,
}) {
  await log(`🚀 Deploying service: ${serviceConfig.displayName || serviceConfig.name}`);

  // Get existing services to allocate port
  const existingServices = await prisma.service.findMany({
    where: {
      instanceId: instanceRecord.id,
      userId,
    },
  });

  // Allocate port if not specified
  const allocatedPort = serviceConfig.appPort || allocatePort(existingServices, serviceConfig.appType === "python" ? 8000 : 3000);

  // Create service record in database
  const serviceRecord = await prisma.service.create({
    data: {
      name: serviceConfig.name,
      displayName: serviceConfig.displayName || serviceConfig.name,
      repoUrl,
      repoName,
      branch,
      repoSubPath: serviceConfig.repoSubPath || "",
      appType: serviceConfig.appType,
      appPort: serviceConfig.deploymentType === "ec2" ? allocatedPort : null,
      entryPoint: serviceConfig.entryPoint,
      buildCommand: serviceConfig.buildCommand,
      outputDirectory: serviceConfig.outputDirectory,
      envVars: serviceConfig.envVars || "",
      deploymentType: serviceConfig.deploymentType,
      healthCheckPath: serviceConfig.healthCheckPath || "/health",
      healthCheckPort: serviceConfig.healthCheckPort || allocatedPort,
      instanceId: instanceRecord.id,
      userId,
      status: "RUNNING",
      minInstances: serviceConfig.minInstances || 1,
      maxInstances: serviceConfig.maxInstances || 3,
      desiredInstances: serviceConfig.desiredInstances || 1,
    },
  });

  try {
    let deploymentResult;
    let targetGroupArn = null;
    let targetGroupName = null;

    if (serviceConfig.deploymentType === "s3") {
      // Deploy to S3
      await log(`📦 Deploying to S3...`);
      
      const s3Result = await deployToS3({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        region,
        repoUrl,
        branch,
        repoName: `${repoName}-${serviceConfig.name}`,
        buildCommand: serviceConfig.buildCommand,
        outputDirectory: serviceConfig.outputDirectory || (serviceConfig.repoSubPath ? `${serviceConfig.repoSubPath}/${serviceConfig.outputDirectory || "dist"}` : serviceConfig.outputDirectory),
        log,
      });

      // Update service with S3 details
      await prisma.service.update({
        where: { id: serviceRecord.id },
        data: {
          s3BucketName: s3Result.bucketName,
          s3Region: region,
          s3WebsiteUrl: s3Result.websiteUrl,
          exposedUrl: s3Result.websiteUrl,
          status: "SUCCESS",
        },
      });

      deploymentResult = {
        exposedUrl: s3Result.websiteUrl,
        s3BucketName: s3Result.bucketName,
      };
    } else {
      // Deploy to EC2
      await log(`🖥️ Deploying to EC2...`);

      // Perform deployment (reuses existing performDeployment logic)
      deploymentResult = await performDeployment({
        instanceRecord,
        repoName: `${repoName}-${serviceConfig.name}`,
        repoUrl,
        branch,
        appType: serviceConfig.appType,
        mainfile: serviceConfig.entryPoint,
        port: allocatedPort.toString(),
        env: serviceConfig.envVars || "",
        repoSubPath: serviceConfig.repoSubPath || "",
        autoDeploy: false,
        log,
        isRedeploy: false,
        existingDeployment: null,
      });

      // Create Target Group for this service
      const ec2Client = new EC2Client({
        region,
        credentials,
      });

      const vpcId = await getVpcIdFromInstance({
        ec2Client,
        instanceId: instanceRecord.awsInstanceId,
      });

      const elbClient = new ElasticLoadBalancingV2Client({
        region,
        credentials,
      });

      const targetGroupResult = await ensureTargetGroup({
        elbClient,
        serviceName: serviceConfig.name,
        serviceId: serviceRecord.id,
        vpcId,
        port: allocatedPort,
        healthCheckPath: serviceConfig.healthCheckPath || "/health",
        region,
        log,
      });

      targetGroupArn = targetGroupResult.targetGroupArn;
      targetGroupName = targetGroupResult.targetGroupName;

      // Register instance with target group
      await registerTarget({
        elbClient,
        targetGroupArn,
        instanceId: instanceRecord.awsInstanceId,
        port: allocatedPort,
        log,
      });

      // Update service with deployment details
      await prisma.service.update({
        where: { id: serviceRecord.id },
        data: {
          targetGroupArn,
          targetGroupName,
          exposedUrl: deploymentResult.exposedUrl,
          slug: deploymentResult.slug,
          status: "SUCCESS",
        },
      });

      // Create deployment record
      await prisma.deployment.create({
        data: {
          userId,
          instanceId: instanceRecord.id,
          serviceId: serviceRecord.id,
          repoName: `${repoName}-${serviceConfig.name}`,
          repoUrl,
          branch,
          status: "SUCCESS",
          ec2InstanceId: instanceRecord.awsInstanceId,
          ec2PublicIp: instanceRecord.publicIp,
          keyPairName: instanceRecord.keyPairName,
          keyMaterial: instanceRecord.keyMaterial,
          appType: serviceConfig.appType,
          appDirectory: deploymentResult.appDir,
          repoPath: deploymentResult.repoDir,
          appPort: allocatedPort,
          exposedUrl: deploymentResult.exposedUrl,
          envVars: serviceConfig.envVars || "",
          repoSubPath: serviceConfig.repoSubPath || "",
          slug: deploymentResult.slug,
          entryPoint: deploymentResult.entryPoint,
        },
      });
    }

    await log(`✅ Service deployed successfully: ${serviceConfig.name}`);
    return serviceRecord;
  } catch (error) {
    await log(`❌ Service deployment failed: ${error.message}`);
    
    // Update service status
    await prisma.service.update({
      where: { id: serviceRecord.id },
      data: {
        status: "FAILED",
      },
    });

    throw error;
  }
}
