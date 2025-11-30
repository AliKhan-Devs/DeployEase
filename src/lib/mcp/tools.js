/**
 * MCP Tools Wrapper
 * These functions wrap the MCP server tools to be used directly in the Next.js app
 */

/**
 * Execute MCP tool by calling the DeployEase API directly
 * This bypasses the MCP protocol since we're in the same codebase
 */
export async function executeMCPTool(tool, args, config) {
  const { apiUrl, sessionToken } = config;

  try {
    let endpoint = "";
    let method = "GET";
    let body = null;

    // Map tools to API endpoints
    switch (tool) {
      case "list_deployments":
        endpoint = `${apiUrl}/api/deployments`;
        if (args.instanceId) {
          endpoint += `?instanceId=${args.instanceId}`;
        }
        break;

      case "list_instances":
        endpoint = `${apiUrl}/api/instances`;
        break;

      case "get_deployment_status":
        endpoint = `${apiUrl}/api/deployments/${args.deploymentId}`;
        break;

      case "deploy_repository":
        endpoint = `${apiUrl}/api/deploy`;
        method = "POST";
        // Extract repoName from repoUrl if not provided
        let repoName = args.repoName;
        if (!repoName && args.repoUrl) {
          const urlParts = args.repoUrl.split("/");
          repoName = urlParts[urlParts.length - 1]?.replace(".git", "") || `repo_${Date.now()}`;
        }
        body = {
          action: "deploy",
          ...args,
          repoName: repoName || args.repoName,
        };
        break;

      case "scale_application":
        endpoint = `${apiUrl}/api/auto-scale`;
        method = "POST";
        body = args;
        break;

      case "increase_volume":
        endpoint = `${apiUrl}/api/increase-volume`;
        method = "POST";
        body = args;
        break;

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${tool}` }],
          isError: true,
        };
    }

    // Make API request - use internal fetch with proper headers
    const headers = {
      "Content-Type": "application/json",
    };

    // For internal API calls, we need to pass the session token
    // Since we're in the server, we'll use the full URL
    const fullUrl = endpoint.startsWith("http") 
      ? endpoint 
      : `${apiUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const response = await fetch(fullUrl, {
      method,
      headers: {
        ...headers,
        ...(sessionToken && {
          Cookie: `next-auth.session-token=${sessionToken}`,
        }),
      },
      ...(body && { body: JSON.stringify(body) }),
      // Important: Don't cache internal API calls
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || response.statusText}\n${JSON.stringify(data, null, 2)}`,
          },
        ],
        isError: true,
      };
    }

    // Format response based on tool
    let resultText = "";
    switch (tool) {
      case "list_deployments":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            resultText = "No deployments found.";
          } else {
            resultText = `📦 Found ${data.length} deployment(s):\n\n${data
              .map(
                (dep, i) =>
                  `${i + 1}. **${dep.repoName}** (ID: ${dep.id})\n   - Status: ${dep.status}\n   - Branch: ${dep.branch}\n   - App Type: ${dep.appType}\n   - URL: ${dep.exposedUrl || "N/A"}\n   - Instance: ${dep.instance?.awsInstanceId || "N/A"}\n   - Started: ${new Date(dep.startedAt).toLocaleString()}`
              )
              .join("\n\n")}`;
          }
        } else {
          resultText = JSON.stringify(data, null, 2);
        }
        break;

      case "list_instances":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            resultText = "No EC2 instances found.";
          } else {
            resultText = `🖥️ Found ${data.length} EC2 instance(s):\n\n${data
              .map(
                (inst, i) =>
                  `${i + 1}. **Instance** (ID: ${inst.id})\n   - AWS Instance ID: ${inst.awsInstanceId}\n   - Public IP: ${inst.publicIp || "N/A"}\n   - Region: ${inst.region}\n   - Instance Type: ${inst.instanceType}\n   - Created: ${new Date(inst.createdAt).toLocaleString()}`
              )
              .join("\n\n")}`;
          }
        } else {
          resultText = JSON.stringify(data, null, 2);
        }
        break;

      case "get_deployment_status":
        const statusEmoji = {
          PENDING: "⏳",
          RUNNING: "🔄",
          SUCCESS: "✅",
          FAILED: "❌",
        };
        resultText = `${statusEmoji[data.status] || "📊"} **Deployment Status**\n\n**ID:** ${data.id}\n**Repository:** ${data.repoName}\n**URL:** ${data.repoUrl}\n**Branch:** ${data.branch}\n**Status:** ${data.status}\n**App Type:** ${data.appType}\n**Exposed URL:** ${data.exposedUrl || "Not available yet"}\n**Instance:** ${data.instance?.awsInstanceId || "N/A"}\n**Started:** ${new Date(data.startedAt).toLocaleString()}${
          data.finishedAt ? `\n**Finished:** ${new Date(data.finishedAt).toLocaleString()}` : ""
        }${data.logs ? `\n\n**Recent Logs:**\n\`\`\`\n${data.logs.slice(-500)}\n\`\`\`` : ""}`;
        break;

      case "deploy_repository":
        resultText = `✅ Deployment queued successfully!\n\nDeployment ID: ${data.deploymentId}\nRepository: ${args.repoUrl}\nBranch: ${args.branch || "main"}\nApp Type: ${args.appType || "node"}\nStatus: Deployment is being processed. Use get_deployment_status to check progress.`;
        break;

      case "scale_application":
        resultText = `✅ Auto-scaling enabled successfully!\n\nInstance ID: ${args.instanceId}\nMin Instances: ${args.minSize || 1}\nMax Instances: ${args.maxSize || 3}\nLoad Balancer URL: ${data.lbDns || "N/A"}\n\nYour application will now automatically scale based on traffic.`;
        break;

      case "increase_volume":
        resultText = `✅ Volume increased successfully!\n\nInstance ID: ${args.instanceId}\nVolume ID: ${data.volumeId}\nPrevious Size: ${data.previousSize} GB\nNew Size: ${data.newSize} GB\nAdditional Storage: +${args.additionalGB} GB\nFilesystem Expanded: ${data.filesystemExpanded ? "Yes" : "No"}\n\n${data.message}`;
        break;

      default:
        resultText = JSON.stringify(data, null, 2);
    }

    return {
      content: [{ type: "text", text: resultText }],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

