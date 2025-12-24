/**
 * Service Infrastructure Utilities
 * 
 * Manages per-service infrastructure resources:
 * - Target Groups
 * - Port allocation
 * - Health checks
 * - Auto Scaling Groups
 */

import {
  ElasticLoadBalancingV2Client,
  CreateTargetGroupCommand,
  DescribeTargetGroupsCommand,
  ModifyTargetGroupCommand,
  DeleteTargetGroupCommand,
  RegisterTargetsCommand,
  DeregisterTargetsCommand,
  DescribeTargetHealthCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";

/**
 * Generate a unique port for a service (starting from 3000, incrementing)
 * @param {Array<Service>} existingServices - Existing services to check ports against
 * @param {number} basePort - Base port to start from
 * @returns {number} - Available port number
 */
export function allocatePort(existingServices, basePort = 3000) {
  const usedPorts = new Set(
    existingServices
      .filter(s => s.appPort)
      .map(s => s.appPort)
  );

  let port = basePort;
  while (usedPorts.has(port)) {
    port++;
  }

  return port;
}

/**
 * Create or get Target Group for a service
 * @param {Object} params - Parameters
 * @param {ElasticLoadBalancingV2Client} params.elbClient - ELB client
 * @param {string} params.serviceName - Service name
 * @param {string} params.serviceId - Service ID (for uniqueness)
 * @param {string} params.vpcId - VPC ID
 * @param {number} params.port - Service port
 * @param {string} params.healthCheckPath - Health check path
 * @param {string} params.region - AWS region
 * @param {Function} params.log - Logging function
 * @returns {Promise<{targetGroupArn: string, targetGroupName: string}>}
 */
export async function ensureTargetGroup({
  elbClient,
  serviceName,
  serviceId,
  vpcId,
  port,
  healthCheckPath = "/health",
  region,
  log,
}) {
  const targetGroupName = `tg-${serviceName}-${serviceId.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  try {
    // Check if target group already exists
    const describeResponse = await elbClient.send(
      new DescribeTargetGroupsCommand({
        Names: [targetGroupName],
      })
    );

    if (describeResponse.TargetGroups && describeResponse.TargetGroups.length > 0) {
      const existing = describeResponse.TargetGroups[0];
      await log(`♻️ Using existing Target Group: ${targetGroupName}`);
      return {
        targetGroupArn: existing.TargetGroupArn,
        targetGroupName: existing.TargetGroupName,
      };
    }
  } catch (error) {
    // Target group doesn't exist, continue to create
  }

  // Create new target group
  await log(`📦 Creating Target Group: ${targetGroupName}...`);

  const createResponse = await elbClient.send(
    new CreateTargetGroupCommand({
      Name: targetGroupName,
      Protocol: "HTTP",
      Port: port,
      VpcId: vpcId,
      HealthCheckProtocol: "HTTP",
      HealthCheckPath: healthCheckPath,
      HealthCheckIntervalSeconds: 30,
      HealthCheckTimeoutSeconds: 5,
      HealthyThresholdCount: 2,
      UnhealthyThresholdCount: 3,
      TargetType: "instance", // Can be "instance" or "ip"
      Matcher: {
        HttpCode: "200-299",
      },
    })
  );

  await log(`✅ Target Group created: ${targetGroupName}`);

  return {
    targetGroupArn: createResponse.TargetGroups[0].TargetGroupArn,
    targetGroupName: createResponse.TargetGroups[0].TargetGroupName,
  };
}

/**
 * Register instance with target group
 * @param {Object} params - Parameters
 * @param {ElasticLoadBalancingV2Client} params.elbClient - ELB client
 * @param {string} params.targetGroupArn - Target Group ARN
 * @param {string} params.instanceId - EC2 Instance ID
 * @param {number} params.port - Instance port
 * @param {Function} params.log - Logging function
 */
export async function registerTarget({
  elbClient,
  targetGroupArn,
  instanceId,
  port,
  log,
}) {
  try {
    await log(`🔗 Registering instance ${instanceId} with Target Group...`);

    await elbClient.send(
      new RegisterTargetsCommand({
        TargetGroupArn: targetGroupArn,
        Targets: [
          {
            Id: instanceId,
            Port: port,
          },
        ],
      })
    );

    await log(`✅ Instance registered with Target Group`);
  } catch (error) {
    await log(`⚠️ Failed to register target: ${error.message}`);
    throw error;
  }
}

/**
 * Check target health
 * @param {Object} params - Parameters
 * @param {ElasticLoadBalancingV2Client} params.elbClient - ELB client
 * @param {string} params.targetGroupArn - Target Group ARN
 * @param {Function} params.log - Logging function
 * @returns {Promise<boolean>} - True if healthy
 */
export async function checkTargetHealth({
  elbClient,
  targetGroupArn,
  log,
}) {
  try {
    const response = await elbClient.send(
      new DescribeTargetHealthCommand({
        TargetGroupArn: targetGroupArn,
      })
    );

    if (!response.TargetHealthDescriptions || response.TargetHealthDescriptions.length === 0) {
      return false;
    }

    // Check if all targets are healthy
    const allHealthy = response.TargetHealthDescriptions.every(
      (target) => target.TargetHealth.State === "healthy"
    );

    return allHealthy;
  } catch (error) {
    await log(`⚠️ Health check failed: ${error.message}`);
    return false;
  }
}

/**
 * Get VPC ID from instance
 * @param {Object} params - Parameters
 * @param {EC2Client} params.ec2Client - EC2 client
 * @param {string} params.instanceId - EC2 Instance ID
 * @returns {Promise<string>} - VPC ID
 */
export async function getVpcIdFromInstance({ ec2Client, instanceId }) {
  const { DescribeInstancesCommand } = await import("@aws-sdk/client-ec2");
  
  const response = await ec2Client.send(
    new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    })
  );

  const instance = response.Reservations?.[0]?.Instances?.[0];
  if (!instance || !instance.VpcId) {
    throw new Error("Could not determine VPC ID from instance");
  }

  return instance.VpcId;
}
