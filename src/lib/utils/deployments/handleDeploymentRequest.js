

import { EC2Client } from "@aws-sdk/client-ec2";
import { createEc2Instance } from "./EC2_Instance.js";
import { performDeployment } from "./performDeployment.js";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../encryptDecrypt.js";
import { detectServices, normalizeServiceConfig } from "../services/serviceDetection.js";
import { deployService } from "../services/serviceDeployment.js";
import { configureApiGatewayForServices } from "../services/apiGatewayIntegration.js";
import { ApiGatewayV2Client } from "@aws-sdk/client-apigatewayv2";

import { getRedisClient } from "../../redis/client.js";
const redis = getRedisClient();

const prisma = new PrismaClient();



export async function handleDeploymentRequest({ session, body, log }) {
  console.log("entered handleDeploymentRequest");
  
  // Handle both session object (from API) and user object (from worker)
  const userId = session?.user?.id || session?.id;
  
  if (!userId) {
    throw new Error("User ID is required. Session object is invalid.");
  }

  // get user from cache or database
  let user = null;
  const cacheKey = `user-details:${userId}`;
  const cachedUser = await redis.get(cacheKey);

  if (cachedUser) {
    user = JSON.parse(cachedUser);
  } else {
    user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await redis.set(cacheKey, JSON.stringify(user));
    }
  }
  if (!user) {
    throw new Error("User not found.");
  }


  const accessKeyId = user.awsAccessKeyId;
  const secretAccessKey = user.awsSecretAccessKey;

  console.log(accessKeyId,secretAccessKey);
  
  const {
    region,
    instanceType,
    repoUrl,
    branch = "main",
    port = "3000",
    mainfile = "index.js",
    env = "",
    appType = "node",
    repoSubPath = "",
    autoDeploy = false,
    targetInstanceId = null,
    // Multi-service deployment flags
    multiService = false, // Enable multi-service mode
    services = null, // Optional: pre-defined services array
    enableApiGateway = false, // Enable API Gateway integration
  } = body;

  // Generate repoName from repoUrl if not provided
  let repoName = body.repoName;
  if (!repoName && repoUrl) {
    // Extract repo name from URL (e.g., https://github.com/user/repo -> repo)
    const urlParts = repoUrl.split("/");
    repoName = urlParts[urlParts.length - 1]?.replace(".git", "") || `No_name_${Date.now()}`;
  }

  if (!repoUrl) {
    throw new Error("Repository URL is required.");
  }
  
  if (!region && !targetInstanceId) {
    throw new Error("AWS region is required for new instances.");
  }
  
    
    await log("🚀 Starting deployment workflow...");
    console.log("started deployment hhh")
    let instanceRecord = null;
    let privateKey = null;
    let ec2Client = null;
    let credentials = { accessKeyId, secretAccessKey };

  
    if (targetInstanceId) {
      instanceRecord = await prisma.ec2Instance.findFirst({
        where: { id: targetInstanceId, userId },
      });
      if (!instanceRecord) {
        throw new Error("Instance not found or access denied.");
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
        throw new Error("AWS credentials and region are required to provision a new instance.");
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
      const finalRegion = instanceRecord.region;
      const finalCredentials = credentials;

      // Multi-service deployment path
      if (multiService || services) {
        await log("🔀 Multi-service deployment mode enabled");
        
        let serviceConfigs = services;
        if (!serviceConfigs) {
          // Auto-detect services from repository
          serviceConfigs = await detectServices(repoUrl, branch, log);
        }

        // Normalize all service configs
        serviceConfigs = serviceConfigs.map(config => normalizeServiceConfig(config));
        
        await log(`📦 Deploying ${serviceConfigs.length} service(s)...`);

        const deployedServices = [];
        const serviceRecords = [];

        // Deploy each service
        for (const serviceConfig of serviceConfigs) {
          try {
            const serviceRecord = await deployService({
              serviceConfig,
              instanceRecord,
              repoUrl,
              branch,
              repoName,
              userId,
              credentials: finalCredentials,
              region: finalRegion,
              log,
            });
            deployedServices.push(serviceRecord);
            serviceRecords.push(serviceRecord);
          } catch (serviceError) {
            await log(`⚠️ Failed to deploy service ${serviceConfig.name}: ${serviceError.message}`);
            // Continue with other services
          }
        }

        // Configure API Gateway if enabled
        let apiGatewayRoutes = [];
        if (enableApiGateway && deployedServices.length > 0) {
          try {
            await log("📡 Configuring API Gateway...");
            const apiGatewayClient = new ApiGatewayV2Client({
              region: finalRegion,
              credentials: finalCredentials,
            });

            apiGatewayRoutes = await configureApiGatewayForServices({
              apiGatewayClient,
              services: serviceRecords,
              region: finalRegion,
              credentials: finalCredentials,
              log,
            });

            // Update services with API Gateway endpoints
            for (const route of apiGatewayRoutes) {
              await prisma.service.update({
                where: { id: route.serviceId },
                data: {
                  apiGatewayRouteKey: route.routeKey,
                  apiGatewayEndpoint: route.endpoint,
                },
              });
            }

            await log(`✅ API Gateway configured with ${apiGatewayRoutes.length} route(s)`);
          } catch (apiGatewayError) {
            await log(`⚠️ API Gateway configuration failed: ${apiGatewayError.message}`);
            // Continue - API Gateway is optional
          }
        }

        // Clear cache
        await redis.del(`analytics:${userId}`);
        await redis.del(`instances:${userId}`);
        await redis.del(`deployments:${userId}`);

        return {
          success: true,
          message: `Multi-service deployment completed. ${deployedServices.length} service(s) deployed.`,
          instanceId: instanceRecord.awsInstanceId,
          publicIp: instanceRecord.publicIp,
          keyPairName: instanceRecord.keyPairName,
          privateKey: privateKey || undefined,
          services: deployedServices.map(s => ({
            id: s.id,
            name: s.name,
            displayName: s.displayName,
            exposedUrl: s.exposedUrl,
            apiGatewayEndpoint: apiGatewayRoutes.find(r => r.serviceId === s.id)?.endpoint,
            status: s.status,
          })),
          apiGatewayRoutes,
        };
      }

      // Single-service deployment path (backward compatible)
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
      
      // Remove all cached information because now we have a new deployment for this instance state so we need to remove instances and deployments as well as analytics removal 

      await redis.del(`analytics:${userId}`);
      await redis.del(`instances:${userId}`);
      await redis.del(`deployments:${userId}`);

      const responsePayload = {
        success: true,
        message: "Deployment completed successfully.",
        instanceId: instanceRecord.awsInstanceId,
        publicIp: instanceRecord.publicIp,
        keyPairName: instanceRecord.keyPairName,
        privateKey: privateKey || undefined,
        deployment,
      };
  
      // Return payload (not Response object) since this can be called from worker
      return responsePayload;
    } catch (err) {
      await log(`❌ Deployment error: ${err.message || err}`);
      
      // Create failed deployment record
      try {
        await prisma.deployment.create({
          data: {
            user: { connect: { id: userId } },
            instance: instanceRecord ? { connect: { id: instanceRecord.id } } : undefined,
            repoName: repoName || "Unknown",
            repoUrl,
            branch,
            status: "FAILED",
            logs: String(err.stack || err.message || err),
          },
        });
      } catch (dbErr) {
        console.error("Failed to create failed deployment record:", dbErr);
      }
      
      // Throw error so worker can handle it
      throw err;
    }
  }
  

