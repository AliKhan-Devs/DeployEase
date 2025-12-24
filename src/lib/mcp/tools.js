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
        
      case "run_ssh_command":
        if (!args.instanceId || !args.command) {
          return { content: [{ type: "text", text: "Instance ID and command are required." }], isError: true };
        }

        const sshResponse = await fetch(`${apiUrl}/api/ssh/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
          body: JSON.stringify({ instanceId: args.instanceId, command: args.command }),
          cache: "no-store",
        });

        const sshData = await sshResponse.json();

        if (!sshResponse.ok) return { content: [{ type: "text", text: `Error: ${sshData.error}` }], isError: true };

        const output = sshData.result?.stdout || "";
        const error = sshData.result?.stderr || "";
        const exitCode = sshData.result?.code || 0;
        
        let resultText = "";
        if (output) resultText = output;
        if (error) resultText += (resultText ? "\n\nSTDERR:\n" : "") + error;
        if (exitCode !== 0 && !resultText) resultText = `Command exited with code ${exitCode}`;

        return { content: [{ type: "text", text: resultText || "Command executed." }], isError: exitCode !== 0 };

      case "run_ssh_commands":
        if (!args.instanceId || !Array.isArray(args.commands) || args.commands.length === 0) {
          return { content: [{ type: "text", text: "Instance ID and commands array are required." }], isError: true };
        }

        // Use the optimized multi-command endpoint
        const multiCmdResponse = await fetch(`${apiUrl}/api/ssh/run-multiple`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
          body: JSON.stringify({ instanceId: args.instanceId, commands: args.commands }),
          cache: "no-store",
        });

        const multiCmdData = await multiCmdResponse.json();

        if (!multiCmdResponse.ok) {
          return { content: [{ type: "text", text: `Error: ${multiCmdData.error}` }], isError: true };
        }

        const { results, summary } = multiCmdData;
        
        // Format output with clear separation
        const combinedOutput = results.map((r, i) => 
          `--- Command ${i + 1}: ${r.command} ---\n${r.stdout || ""}${r.stderr ? `\nSTDERR: ${r.stderr}` : ""}${r.code !== 0 ? `\n[Exit code: ${r.code}]` : ""}`
        ).join("\n\n");

        // Add summary if multiple commands
        let finalOutput = combinedOutput;
        if (results.length > 1 && summary) {
          finalOutput += `\n\n--- Summary ---\nTotal: ${summary.total}, Succeeded: ${summary.succeeded}, Failed: ${summary.failed}`;
        }

        return { 
          content: [{ type: "text", text: finalOutput }], 
          isError: !multiCmdData.success,
          metadata: { summary, results }
        };

      case "check_instance_health":
        if (!args.instanceId) {
          return { content: [{ type: "text", text: "Instance ID is required." }], isError: true };
        }

        // Execute multiple health check commands
        const healthCommands = [
          "uptime",
          "free -h",
          "df -h",
          "ps aux --sort=-%mem | head -10",
          "systemctl list-units --state=failed --no-pager",
          "pm2 list || echo 'PM2 not found'",
          "netstat -tuln | head -20 || ss -tuln | head -20",
        ];

        const healthResults = [];
        for (const cmd of healthCommands) {
          const healthResponse = await fetch(`${apiUrl}/api/ssh/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
            body: JSON.stringify({ instanceId: args.instanceId, command: cmd }),
          });

          const healthData = await healthResponse.json();
          if (healthData.result) {
            healthResults.push({ command: cmd, result: healthData.result });
          }
        }

        let healthReport = "🏥 **Instance Health Report**\n\n";
        
        healthResults.forEach(({ command, result }) => {
          const output = result.stdout || result.stderr || "N/A";
          healthReport += `**${command}:**\n\`\`\`\n${output}\n\`\`\`\n\n`;
        });

        return { content: [{ type: "text", text: healthReport }], isError: false };

      case "view_deployment_logs":
        if (!args.deploymentId) {
          return { content: [{ type: "text", text: "Deployment ID is required." }], isError: true };
        }

        // First get deployment details
        const deploymentResponse = await fetch(`${apiUrl}/api/deployments/${args.deploymentId}`, {
          headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
        });

        if (!deploymentResponse.ok) {
          return { content: [{ type: "text", text: "Failed to fetch deployment details." }], isError: true };
        }

        const deployment = await deploymentResponse.json();
        const lines = args.lines || 100;

        if (!deployment.instance?.awsInstanceId) {
          return { content: [{ type: "text", text: "Deployment instance not found." }], isError: true };
        }

        // Get logs from instance
        const logCommands = [
          `pm2 logs --lines ${lines} --nostream || echo 'PM2 not available'`,
          `journalctl -u ${deployment.repoName} -n ${lines} 2>/dev/null || echo 'Systemd service not found'`,
          `tail -n ${lines} ~/${deployment.repoName}/logs/*.log 2>/dev/null || echo 'Log files not found'`,
        ];

        let logsReport = `📋 **Deployment Logs for ${deployment.repoName}**\n\n`;
        logsReport += `**Deployment ID:** ${deployment.id}\n`;
        logsReport += `**Status:** ${deployment.status}\n`;
        logsReport += `**Instance:** ${deployment.instance.awsInstanceId}\n\n`;

        for (const cmd of logCommands) {
          const logResponse = await fetch(`${apiUrl}/api/ssh/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
            body: JSON.stringify({ instanceId: deployment.instance.awsInstanceId, command: cmd }),
          });

          const logData = await logResponse.json();
          if (logData.result?.stdout) {
            logsReport += `**${cmd}:**\n\`\`\`\n${logData.result.stdout}\n\`\`\`\n\n`;
          }
        }

        if (deployment.logs) {
          logsReport += `**Deployment Logs:**\n\`\`\`\n${deployment.logs.slice(-1000)}\n\`\`\`\n`;
        }

        return { content: [{ type: "text", text: logsReport }], isError: false };

      case "restart_service":
        if (!args.instanceId) {
          return { content: [{ type: "text", text: "Instance ID is required." }], isError: true };
        }

        // Intelligent service restart with error recovery
        try {
          // Step 1: Check what's running
          const checkCommands = [
            "pm2 list",
            "systemctl list-units --type=service --state=running 2>/dev/null | head -20",
            "ps aux | grep -E '(node|npm|python|pm2)' | grep -v grep | head -10",
          ];

          let serviceInfo = null;
          for (const cmd of checkCommands) {
            const checkResponse = await fetch(`${apiUrl}/api/ssh/run`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
              body: JSON.stringify({ instanceId: args.instanceId, command: cmd }),
              cache: "no-store",
            });

            const checkData = await checkResponse.json();
            const output = checkData.result?.stdout || "";

            if (cmd.includes("pm2") && (output.includes("online") || output.includes("┌─"))) {
              serviceInfo = { type: "pm2", output };
              break;
            } else if (output.includes("systemd") || output.includes(".service")) {
              serviceInfo = { type: "systemd", output };
            }
          }

          // Step 2: Get deployment info if available
          let deployment = null;
          if (args.deploymentId) {
            try {
              const depResponse = await fetch(`${apiUrl}/api/deployments/${args.deploymentId}`, {
                headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
                cache: "no-store",
              });
              if (depResponse.ok) {
                deployment = await depResponse.json();
              }
            } catch (e) {
              console.warn("Could not fetch deployment info:", e);
            }
          }

          // Step 3: Restart based on service type
          let restartResult = "";
          let restartSuccess = false;

          if (serviceInfo?.type === "pm2") {
            // PM2 restart
            const pm2RestartResponse = await fetch(`${apiUrl}/api/ssh/run`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
              body: JSON.stringify({ instanceId: args.instanceId, command: "pm2 restart all" }),
              cache: "no-store",
            });

            const pm2Data = await pm2RestartResponse.json();
            const pm2Output = pm2Data.result?.stdout || pm2Data.result?.stderr || "";
            restartSuccess = pm2Data.result?.code === 0;

            if (restartSuccess) {
              restartResult = `✅ Successfully restarted PM2 services:\n${pm2Output}`;
            } else {
              // Try alternative: pm2 reload
              const reloadResponse = await fetch(`${apiUrl}/api/ssh/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
                body: JSON.stringify({ instanceId: args.instanceId, command: "pm2 reload all" }),
                cache: "no-store",
              });
              const reloadData = await reloadResponse.json();
              restartSuccess = reloadData.result?.code === 0;
              restartResult = restartSuccess 
                ? `✅ Reloaded PM2 services (restart failed, reload succeeded):\n${reloadData.result?.stdout || ""}`
                : `❌ Failed to restart PM2. Error: ${pm2Output}`;
            }
          } else if (deployment) {
            // Try application-specific restart
            const appDir = deployment.appDirectory || deployment.repoName;
            const restartCmd = `cd ~/${appDir} 2>/dev/null && (pm2 restart all || pm2 restart ${appDir} || npm restart || sudo systemctl restart ${appDir} || echo "Manual restart needed")`;
            
            const appRestartResponse = await fetch(`${apiUrl}/api/ssh/run`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
              body: JSON.stringify({ instanceId: args.instanceId, command: restartCmd }),
              cache: "no-store",
            });

            const appData = await appRestartResponse.json();
            const appOutput = appData.result?.stdout || appData.result?.stderr || "";
            restartSuccess = appData.result?.code === 0 || appOutput.includes("restarted") || appOutput.includes("reloaded");

            restartResult = restartSuccess
              ? `✅ Restarted application service (${deployment.repoName}):\n${appOutput}`
              : `⚠️ Could not automatically restart. Service may need manual intervention.\nOutput: ${appOutput}`;
          } else {
            // Last resort: try common restart commands
            const fallbackCommands = [
              "sudo systemctl restart nginx",
              "sudo systemctl restart apache2",
              "pm2 restart all",
            ];

            for (const cmd of fallbackCommands) {
              const fallbackResponse = await fetch(`${apiUrl}/api/ssh/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
                body: JSON.stringify({ instanceId: args.instanceId, command: cmd }),
                cache: "no-store",
              });

              const fallbackData = await fallbackResponse.json();
              if (fallbackData.result?.code === 0) {
                restartResult = `✅ Restarted service using: ${cmd}\n${fallbackData.result?.stdout || ""}`;
                restartSuccess = true;
                break;
              }
            }

            if (!restartSuccess) {
              restartResult = "⚠️ Could not automatically determine or restart service. Please check logs or specify the exact service name.";
            }
          }

          return { content: [{ type: "text", text: restartResult }], isError: !restartSuccess };
        } catch (error) {
          return { 
            content: [{ type: "text", text: `❌ Error during service restart: ${error.message}` }], 
            isError: true 
          };
        }

      case "check_resources":
        if (!args.instanceId) {
          return { content: [{ type: "text", text: "Instance ID is required." }], isError: true };
        }

        const resourceCommands = [
          "free -h",
          "df -h",
          "uptime",
          "top -bn1 | head -20",
          "ps aux --sort=-%cpu | head -5",
          "ps aux --sort=-%mem | head -5",
        ];

        let resourceReport = "📊 **Resource Usage Report**\n\n";

        for (const cmd of resourceCommands) {
          const resResponse = await fetch(`${apiUrl}/api/ssh/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
            body: JSON.stringify({ instanceId: args.instanceId, command: cmd }),
          });

          const resData = await resResponse.json();
          const output = resData.result?.stdout || resData.result?.stderr || "N/A";
          resourceReport += `**${cmd}:**\n\`\`\`\n${output}\n\`\`\`\n\n`;
        }

        return { content: [{ type: "text", text: resourceReport }], isError: false };

      case "troubleshoot_deployment":
        if (!args.deploymentId) {
          return { content: [{ type: "text", text: "Deployment ID is required." }], isError: true };
        }

        try {
          // Get deployment details first
          const troubleshootDepResponse = await fetch(`${apiUrl}/api/deployments/${args.deploymentId}`, {
            headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
            cache: "no-store",
          });

          if (!troubleshootDepResponse.ok) {
            return { content: [{ type: "text", text: "Failed to fetch deployment details." }], isError: true };
          }

          const troubleshootDeployment = await troubleshootDepResponse.json();

          if (!troubleshootDeployment.instance?.awsInstanceId) {
            return { content: [{ type: "text", text: "Deployment instance not found." }], isError: true };
          }

          const instanceId = troubleshootDeployment.instance.awsInstanceId;
          const appDir = troubleshootDeployment.appDirectory || troubleshootDeployment.repoName;
          const appPort = troubleshootDeployment.appPort || "3000";
          
          let troubleshootReport = `🔍 **Comprehensive Troubleshooting Report for ${troubleshootDeployment.repoName}**\n\n`;
          troubleshootReport += `**Deployment ID:** ${troubleshootDeployment.id}\n`;
          troubleshootReport += `**Status:** ${troubleshootDeployment.status}\n`;
          troubleshootReport += `**Instance:** ${instanceId}\n`;
          troubleshootReport += `**App Directory:** ${appDir}\n`;
          troubleshootReport += `**Port:** ${appPort}\n`;
          troubleshootReport += `**URL:** ${troubleshootDeployment.exposedUrl || "N/A"}\n\n`;
          troubleshootReport += `---\n\n`;

          // Comprehensive troubleshooting checks with error recovery
          const troubleshootSteps = [
            { 
              name: "Service Status (PM2)", 
              command: "pm2 list && pm2 info all",
              critical: false 
            },
            { 
              name: "Service Status (Systemd)", 
              command: `systemctl status ${troubleshootDeployment.repoName} 2>/dev/null || systemctl list-units --type=service | grep -E '(${troubleshootDeployment.repoName}|node|npm)' || echo 'No systemd service found'`,
              critical: false 
            },
            { 
              name: "Process Status", 
              command: `ps aux | grep -E '(node|npm|${appDir})' | grep -v grep || echo 'No processes found'`,
              critical: false 
            },
            { 
              name: "Disk Space", 
              command: "df -h && echo '---' && du -sh ~/* 2>/dev/null | sort -hr | head -10",
              critical: true 
            },
            { 
              name: "Memory Usage", 
              command: "free -h && echo '---' && ps aux --sort=-%mem | head -5",
              critical: true 
            },
            { 
              name: "Network Ports", 
              command: `(netstat -tuln 2>/dev/null || ss -tuln 2>/dev/null) | grep -E '(:${appPort}|LISTEN)' || echo 'Port ${appPort} not listening'`,
              critical: true 
            },
            { 
              name: "Application Directory", 
              command: `ls -la ~/${appDir} 2>/dev/null || echo 'Directory not found: ~/${appDir}'`,
              critical: false 
            },
            { 
              name: "Recent System Errors", 
              command: "journalctl -p err --since '1 hour ago' -n 20 2>/dev/null || dmesg | tail -30 || echo 'No system errors found'",
              critical: false 
            },
            { 
              name: "Application Logs (PM2)", 
              command: `pm2 logs --lines 30 --nostream --raw 2>/dev/null || echo 'PM2 logs unavailable'`,
              critical: false 
            },
            { 
              name: "Application Logs (File)", 
              command: `tail -50 ~/${appDir}/logs/*.log 2>/dev/null || tail -50 ~/${appDir}/*.log 2>/dev/null || echo 'Log files not found'`,
              critical: false 
            },
            { 
              name: "Network Connectivity", 
              command: `curl -I http://localhost:${appPort} 2>&1 | head -5 || echo 'Local connection test failed'`,
              critical: false 
            },
          ];

          let issuesFound = [];
          let criticalIssues = [];

          for (const step of troubleshootSteps) {
            try {
              const stepResponse = await fetch(`${apiUrl}/api/ssh/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(sessionToken && { Cookie: `next-auth.session-token=${sessionToken}` }) },
                body: JSON.stringify({ instanceId, command: step.command }),
                cache: "no-store",
              });

              const stepData = await stepResponse.json();
              const output = stepData.result?.stdout || stepData.result?.stderr || "";
              const exitCode = stepData.result?.code || 0;
              
              if (output && output.length > 0 && !output.includes("not found") && !output.includes("No such file")) {
                troubleshootReport += `### ${step.name}\n\`\`\`\n${output.slice(0, 1500)}\n\`\`\`\n\n`;
                
                // Detect potential issues
                if (exitCode !== 0) {
                  issuesFound.push(`${step.name}: Exit code ${exitCode}`);
                  if (step.critical) criticalIssues.push(step.name);
                }
                
                // Pattern-based issue detection
                if (output.toLowerCase().includes("error") || output.toLowerCase().includes("failed") || output.toLowerCase().includes("refused")) {
                  issuesFound.push(`${step.name}: Errors detected in output`);
                  if (step.critical) criticalIssues.push(step.name);
                }
                
                if (step.name.includes("Disk") && output.includes("100%")) {
                  criticalIssues.push("Disk space at 100%");
                }
                
                if (step.name.includes("Memory") && output.includes("0 ")) {
                  const memMatch = output.match(/(\d+)M\s+(\d+)M/);
                  if (memMatch && parseInt(memMatch[2]) / parseInt(memMatch[1]) > 0.9) {
                    criticalIssues.push("Memory usage > 90%");
                  }
                }
              }
            } catch (stepError) {
              if (step.critical) {
                criticalIssues.push(`${step.name}: Check failed`);
              }
            }
          }

          // Add deployment logs if available
          if (troubleshootDeployment.logs) {
            troubleshootReport += `### Deployment Logs\n\`\`\`\n${troubleshootDeployment.logs.slice(-1000)}\n\`\`\`\n\n`;
            
            // Check logs for errors
            const logErrors = troubleshootDeployment.logs.match(/(error|Error|ERROR|failed|Failed|FAILED)/g);
            if (logErrors) {
              issuesFound.push(`Found ${logErrors.length} error references in deployment logs`);
            }
          }

          // Summary and recommendations
          troubleshootReport += `---\n\n### 🔍 Analysis Summary\n\n`;
          
          if (criticalIssues.length > 0) {
            troubleshootReport += `⚠️ **Critical Issues Found:**\n${criticalIssues.map(i => `- ${i}`).join("\n")}\n\n`;
          }
          
          if (issuesFound.length > 0) {
            troubleshootReport += `📋 **Issues Detected:**\n${issuesFound.map(i => `- ${i}`).join("\n")}\n\n`;
          } else {
            troubleshootReport += `✅ No obvious issues detected in system checks.\n\n`;
          }

          // Recommendations
          troubleshootReport += `### 💡 Recommended Actions\n\n`;
          if (criticalIssues.includes("Disk space at 100%")) {
            troubleshootReport += `- Increase disk space using increase_volume tool\n`;
          }
          if (criticalIssues.includes("Memory usage > 90%")) {
            troubleshootReport += `- Consider scaling to larger instance or enable auto-scaling\n`;
          }
          if (troubleshootDeployment.status === "FAILED") {
            troubleshootReport += `- Deployment failed. Check logs above for errors\n`;
            troubleshootReport += `- Consider redeploying or checking repository configuration\n`;
          }
          if (!issuesFound.length && troubleshootDeployment.status !== "SUCCESS") {
            troubleshootReport += `- Service appears healthy. Status may be outdated. Try restart_service if needed.\n`;
          }

          return { 
            content: [{ type: "text", text: troubleshootReport }], 
            isError: criticalIssues.length > 0,
            metadata: { issuesFound, criticalIssues, deployment: troubleshootDeployment }
          };
        } catch (error) {
          return { 
            content: [{ type: "text", text: `❌ Error during troubleshooting: ${error.message}` }], 
            isError: true 
          };
        }

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
        resultText = `${statusEmoji[data.status] || "📊"} **Deployment Status**\n\n**ID:** ${data.id}\n**Repository:** ${data.repoName}\n**URL:** ${data.repoUrl}\n**Branch:** ${data.branch}\n**Status:** ${data.status}\n**App Type:** ${data.appType}\n**Exposed URL:** ${data.exposedUrl || "Not available yet"}\n**Instance:** ${data.instance?.awsInstanceId || "N/A"}\n**Started:** ${new Date(data.startedAt).toLocaleString()}${data.finishedAt ? `\n**Finished:** ${new Date(data.finishedAt).toLocaleString()}` : ""
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

