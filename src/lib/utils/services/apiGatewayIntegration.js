/**
 * API Gateway Integration
 * 
 * Automatically configure AWS API Gateway routes for deployed services
 */

import {
  ApiGatewayV2Client,
  CreateApiCommand,
  GetApisCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
  GetIntegrationsCommand,
  CreateDeploymentCommand,
} from "@aws-sdk/client-apigatewayv2";
import {
  ElasticLoadBalancingV2Client,
  DescribeTargetGroupsCommand,
  DescribeLoadBalancersCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";

/**
 * Get or create API Gateway REST API
 * @param {Object} params - Parameters
 * @param {ApiGatewayV2Client} params.apiGatewayClient - API Gateway client
 * @param {string} params.apiName - API name
 * @param {Function} params.log - Logging function
 * @returns {Promise<{apiId: string, apiEndpoint: string}>}
 */
export async function getOrCreateApiGateway({
  apiGatewayClient,
  apiName,
  log,
}) {
  try {
    // Check if API already exists
    const apisResponse = await apiGatewayClient.send(new GetApisCommand({}));
    const existingApi = apisResponse.Items?.find(
      (api) => api.Name === apiName
    );

    if (existingApi) {
      await log(`♻️ Using existing API Gateway: ${existingApi.Name}`);
      return {
        apiId: existingApi.ApiId,
        apiEndpoint: existingApi.ApiEndpoint,
      };
    }

    // Create new API Gateway
    await log(`📡 Creating API Gateway: ${apiName}...`);
    const createResponse = await apiGatewayClient.send(
      new CreateApiCommand({
        Name: apiName,
        ProtocolType: "HTTP", // HTTP API (cheaper than REST API)
        Description: `API Gateway for DeployEase services`,
      })
    );

    await log(`✅ API Gateway created: ${createResponse.ApiId}`);

    // Create default stage
    await apiGatewayClient.send(
      new CreateStageCommand({
        ApiId: createResponse.ApiId,
        StageName: "$default",
        AutoDeploy: true,
      })
    );

    return {
      apiId: createResponse.ApiId,
      apiEndpoint: createResponse.ApiEndpoint,
    };
  } catch (error) {
    await log(`⚠️ API Gateway error: ${error.message}`);
    throw error;
  }
}

/**
 * Create API Gateway route for a service
 * @param {Object} params - Parameters
 * @param {ApiGatewayV2Client} params.apiGatewayClient - API Gateway client
 * @param {string} params.apiId - API ID
 * @param {Object} params.service - Service record
 * @param {string} params.targetGroupArn - Target Group ARN
 * @param {string} params.loadBalancerArn - Load Balancer ARN
 * @param {string} params.region - AWS region
 * @param {Function} params.log - Logging function
 * @returns {Promise<{routeKey: string, endpoint: string}>}
 */
export async function createApiGatewayRoute({
  apiGatewayClient,
  apiId,
  service,
  targetGroupArn,
  loadBalancerArn,
  region,
  log,
}) {
  try {
    // Get VPC Link integration ID (would need to be created separately)
    // For now, we'll use HTTP proxy integration directly to ALB
    const integrationUri = `arn:aws:elasticloadbalancing:${region}:*:loadbalancer/app/*/${loadBalancerArn.split("/").slice(-1)[0]}`;

    // Create integration
    const routePath = service.repoSubPath 
      ? `/${service.name}` 
      : `/${service.name}`;

    await log(`🔗 Creating API Gateway route: ${routePath}...`);

    // Get ALB DNS name
    const elbClient = new ElasticLoadBalancingV2Client({
      region,
    });

    const lbResponse = await elbClient.send(
      new DescribeLoadBalancersCommand({
        LoadBalancerArns: [loadBalancerArn],
      })
    );

    const loadBalancerDns = lbResponse.LoadBalancers?.[0]?.DNSName;
    if (!loadBalancerDns) {
      throw new Error("Could not get Load Balancer DNS name");
    }

    // Create HTTP integration
    const integrationResponse = await apiGatewayClient.send(
      new CreateIntegrationCommand({
        ApiId: apiId,
        IntegrationType: "HTTP_PROXY",
        IntegrationUri: `http://${loadBalancerDns}${routePath}`,
        IntegrationMethod: "ANY",
        PayloadFormatVersion: "1.0",
      })
    );

    // Create route
    const routeResponse = await apiGatewayClient.send(
      new CreateRouteCommand({
        ApiId: apiId,
        RouteKey: `ANY ${routePath}`,
        Target: `integrations/${integrationResponse.IntegrationId}`,
      })
    );

    const routeKey = routeResponse.RouteKey;
    await log(`✅ Route created: ${routeKey}`);

    return {
      routeKey,
      integrationId: integrationResponse.IntegrationId,
    };
  } catch (error) {
    await log(`⚠️ Failed to create API Gateway route: ${error.message}`);
    // Don't throw - API Gateway is optional
    return null;
  }
}

/**
 * Configure API Gateway for all services
 * @param {Object} params - Parameters
 * @param {ApiGatewayV2Client} params.apiGatewayClient - API Gateway client
 * @param {Array<Service>} params.services - Service records
 * @param {string} params.region - AWS region
 * @param {string} params.credentials - AWS credentials
 * @param {Function} params.log - Logging function
 * @returns {Promise<Array<{serviceId: string, routeKey: string, endpoint: string}>>}
 */
export async function configureApiGatewayForServices({
  apiGatewayClient,
  services,
  region,
  credentials,
  log,
}) {
  // Filter services that are deployed to EC2 (have target groups)
  const ec2Services = services.filter((s) => s.targetGroupArn && s.deploymentType === "ec2");

  if (ec2Services.length === 0) {
    await log(`ℹ️ No EC2 services found, skipping API Gateway configuration`);
    return [];
  }

  // Get or create API Gateway
  const { apiId, apiEndpoint } = await getOrCreateApiGateway({
    apiGatewayClient,
    apiName: "deployease-services-api",
    log,
  });

  // Get Load Balancer ARN from first service's target group
  const elbClient = new ElasticLoadBalancingV2Client({
    region,
    credentials,
  });

  const targetGroupResponse = await elbClient.send(
    new DescribeTargetGroupsCommand({
      TargetGroupArns: [ec2Services[0].targetGroupArn],
    })
  );

  const loadBalancerArn = targetGroupResponse.TargetGroups?.[0]?.LoadBalancerArns?.[0];
  if (!loadBalancerArn) {
    await log(`⚠️ Could not determine Load Balancer ARN, skipping API Gateway routes`);
    return [];
  }

  // Create routes for each service
  const routes = [];
  for (const service of ec2Services) {
    const routeResult = await createApiGatewayRoute({
      apiGatewayClient,
      apiId,
      service,
      targetGroupArn: service.targetGroupArn,
      loadBalancerArn,
      region,
      log,
    });

    if (routeResult) {
      routes.push({
        serviceId: service.id,
        routeKey: routeResult.routeKey,
        endpoint: `${apiEndpoint}${routeResult.routeKey.split(" ")[1]}`,
        integrationId: routeResult.integrationId,
      });
    }
  }

  // Deploy API Gateway
  await apiGatewayClient.send(
    new CreateDeploymentCommand({
      ApiId: apiId,
      StageName: "$default",
    })
  );

  return routes;
}
