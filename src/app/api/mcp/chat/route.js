import { getAuthSession } from "@/lib/authSession";
import { cookies } from "next/headers";
import { executeMCPTool } from "@/lib/mcp/tools";

// Context extraction helper
function extractContextFromMessages(messages) {
  const context = {
    instances: new Map(),
    deployments: new Map(),
    recentTools: [],
  };

  // Extract context from previous tool calls and results
  for (const msg of messages) {
    if (msg.role === "tool") {
      const content = msg.content || "";
      
      // Extract instance IDs
      const instanceMatches = content.match(/Instance.*ID[:\s]+(i-[a-z0-9]+|inst[_\w]+)/gi);
      if (instanceMatches) {
        instanceMatches.forEach(match => {
          const id = match.split(/:|\s+/).pop();
          if (id) context.instances.set(id, { found: true, lastSeen: Date.now() });
        });
      }
      
      // Extract deployment IDs
      const deploymentMatches = content.match(/Deployment.*ID[:\s]+([a-z0-9]+)/gi);
      if (deploymentMatches) {
        deploymentMatches.forEach(match => {
          const id = match.split(/:|\s+/).pop();
          if (id) context.deployments.set(id, { found: true, lastSeen: Date.now() });
        });
      }
    }
  }

  return context;
}

const SYSTEM_PROMPT = `You are DeployEase AI Assistant, an advanced DevOps engineer AI that helps users deploy and manage applications on AWS EC2. DeployEase is a platform (founded by Ali Khan) that automates AWS deployments without manual configuration of servers, ALBs, etc., bridging the gap between AWS importance and ease of use.

**Your Role:**
You are a COMPLETE DevOps Engineer. Users should be able to chat with you naturally about any infrastructure issue or operation, and you should handle it end-to-end. You think strategically, plan multi-step operations, and only show users the results - not every technical command.

**Core Principles:**
1. **Proactive Intelligence**: Don't just execute single commands. Understand the user's goal and plan a complete solution.
2. **Multi-Step Operations**: Break complex tasks into logical steps and execute them automatically.
3. **Context Awareness**: Remember what you've learned about instances, deployments, and current state.
4. **Error Recovery**: When something fails, diagnose the issue and attempt recovery automatically.
5. **User-Friendly**: Show users outcomes, not technical details. Explain in simple terms what you're doing and why.
6. **Complete Solutions**: When a user reports an issue, investigate thoroughly: check logs, resources, services, then fix it.

**Capabilities:**
1. **Deploy & Manage**: Deploy repositories, manage instances, configure environments
2. **Troubleshoot**: Diagnose and fix deployment issues, service failures, resource problems
3. **Monitor & Optimize**: Check health, view logs, monitor resources, optimize performance
4. **Scale & Maintain**: Auto-scale applications, manage storage, restart services
5. **SSH Operations**: Execute complex multi-command operations on instances seamlessly

**Workflow for Complex Tasks:**
1. **Understand**: Parse the user's request and identify the goal
2. **Investigate**: Gather necessary information (list instances, check status, view logs)
3. **Plan**: Break the task into steps
4. **Execute**: Run the steps automatically using multiple tools/commands
5. **Verify**: Check results and confirm success
6. **Report**: Tell the user what was done and the outcome

**Example Thinking Process:**
User: "My app is not responding"
- Step 1: List instances to find the relevant one
- Step 2: Check deployment status
- Step 3: View recent logs to identify the issue
- Step 4: Check if service is running (SSH: pm2 list / systemctl status)
- Step 5: Check resources (SSH: df -h, free -m, top)
- Step 6: Fix the issue (restart service, clear logs, increase resources if needed)
- Step 7: Verify it's working
- Step 8: Report to user in simple terms

**Available Tools:**
- deploy_repository: Deploy GitHub repo (repoUrl required, optional: branch, appType, instanceType, region, targetInstanceId, envVars, repoName, mainfile)
- list_deployments: List all deployments (optional: instanceId)
- list_instances: List all EC2 instances
- get_deployment_status: Get deployment details (deploymentId required)
- scale_application: Enable auto-scaling (instanceId required, optional: minSize, maxSize)
- increase_volume: Increase storage (instanceId, additionalGB required)
- run_ssh_command: Execute single SSH command (instanceId, command required)
- run_ssh_commands: Execute multiple SSH commands in sequence (instanceId, commands array required)
- check_instance_health: Comprehensive health check (instanceId required)
- view_deployment_logs: Get detailed deployment logs (deploymentId required)
- restart_service: Restart application service (instanceId, deploymentId required)
- check_resources: Check CPU, memory, disk usage (instanceId required)
- troubleshoot_deployment: Diagnose deployment issues (deploymentId required)

**Important Guidelines:**
- For troubleshooting, ALWAYS investigate before fixing. Use multiple tools to understand the full picture.
- When executing SSH commands, think about what information you need and chain commands intelligently.
- If a deployment fails, check logs first, then investigate the instance state.
- Be autonomous: If you need to check something, do it. Don't ask the user for information you can gather yourself.
- When user says "fix it" or "check why it's not working", take full ownership and complete the investigation+fix cycle.
- Only ask users for information you cannot obtain programmatically (like AWS credentials, repository URLs for new deployments).

**Communication Style:**
- Start with understanding the problem: "Let me investigate why your app isn't responding..."
- Show progress naturally: "Checking your instances... Found the deployment. Now examining logs..."
- Report results clearly: "✅ Fixed! Your app was down due to memory exhaustion. I've restarted it and it's now responding."

Remember: You are not a command executor. You are a DevOps engineer solving problems.
Some Important Instructions about Instances that are created by our server:
 - Nginx Configutaion file name deployease.conf
 
`;

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "deploy_repository",
      description: "Deploy a GitHub repository to AWS EC2",
      parameters: {
        type: "object",
        properties: {
          repoUrl: { type: "string", description: "GitHub repository URL" },
          branch: { type: "string", description: "Git branch (default: main)" },
          appType: { type: "string", enum: ["node", "python", "react", "static"], description: "Application type" },
          instanceType: { type: "string", description: "EC2 instance type (e.g., t3.micro)" },
          region: { type: "string", description: "AWS region" },
          targetInstanceId: { type: "string", description: "Existing instance ID to deploy to empty if want to create new instance" },
          repoName: { type: "string", description: "GitHub repository name" },
          mainfile: { type: "string", description: "Main file name (default: index.js)" },
          envVars: { type: "string", description: "Environment variables in JSON format" },
        },
        required: ["repoUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_deployments",
      description: "List all deployments",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string", description: "Filter by instance ID" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_instances",
      description: "List all EC2 instances",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_deployment_status",
      description: "Get deployment status and details",
      parameters: {
        type: "object",
        properties: {
          deploymentId: { type: "string", description: "Deployment ID" },
        },
        required: ["deploymentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scale_application",
      description: "Enable auto-scaling for an application",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string", description: "EC2 instance ID" },
          minSize: { type: "number", description: "Minimum instances (default: 1)" },
          maxSize: { type: "number", description: "Maximum instances (default: 3)" },
        },
        required: ["instanceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "increase_volume",
      description: "Increase EC2 instance storage volume",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string", description: "EC2 instance ID" },
          additionalGB: { type: "number", description: "Additional storage in GB" },
        },
        required: ["instanceId", "additionalGB"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "run_ssh_command",
      description: "Execute a single shell command on an EC2 instance",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string", description: "Target EC2 instance ID not db id" },
          command: { type: "string", description: "Shell command to execute" },
        },
        required: ["instanceId", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_ssh_commands",
      description: "Execute multiple shell commands in sequence on an EC2 instance. Use this for complex operations that require multiple steps. Commands run in order and results are combined.",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string", description: "Target EC2 instance ID" },
          commands: { 
            type: "array", 
            items: { type: "string" },
            description: "Array of shell commands to execute in sequence" 
          },
        },
        required: ["instanceId", "commands"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_instance_health",
      description: "Perform comprehensive health check on an instance: check service status, resource usage (CPU, memory, disk), network connectivity, and recent errors",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string", description: "EC2 instance ID" },
        },
        required: ["instanceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_deployment_logs",
      description: "Get detailed logs from a deployment. Returns recent application logs, error logs, and deployment history",
      parameters: {
        type: "object",
        properties: {
          deploymentId: { type: "string", description: "Deployment ID" },
          lines: { type: "number", description: "Number of log lines to retrieve (default: 100)" },
        },
        required: ["deploymentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "restart_service",
      description: "Restart an application service on an instance. Automatically detects if using PM2, systemd, or other process managers",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string", description: "EC2 instance ID" },
          deploymentId: { type: "string", description: "Deployment ID to identify the service" },
        },
        required: ["instanceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_resources",
      description: "Check resource usage on an instance: CPU usage, memory usage, disk space, running processes",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string", description: "EC2 instance ID" },
        },
        required: ["instanceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "troubleshoot_deployment",
      description: "Comprehensive troubleshooting: checks deployment status, logs, instance health, service status, and resource usage to identify issues",
      parameters: {
        type: "object",
        properties: {
          deploymentId: { type: "string", description: "Deployment ID to troubleshoot" },
        },
        required: ["deploymentId"],
      },
    },
  },
];

/**
 * AI Chat endpoint that uses OpenAI/Anthropic to understand user requests
 * and execute MCP tools
 */
export async function POST(req) {
  const session = await getAuthSession();
  
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const { messages, provider } = body; // Accept provider from request

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check for AI provider configuration
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // Determine which provider to use
    const selectedProvider = provider || "auto"; // Default to auto-detect

    // If no API keys, use fallback
    if (!openaiApiKey && !anthropicApiKey && !geminiApiKey) {
      return handleSimpleAI(messages);
    }

    // Extract context from messages for context awareness
    const extractedContext = extractContextFromMessages(messages);

    // Route to selected provider
    if (selectedProvider === "openai" && openaiApiKey) {
      return await handleOpenAI(messages, openaiApiKey, extractedContext);
    }
    
    if (selectedProvider === "anthropic" && anthropicApiKey) {
      return await handleAnthropic(messages, anthropicApiKey, extractedContext);
    }
    
    if (selectedProvider === "gemini" && geminiApiKey) {
      return await handleGemini(messages, geminiApiKey, extractedContext);
    }

    // Auto-detect: use first available
    if (openaiApiKey) {
      return await handleOpenAI(messages, openaiApiKey, extractedContext);
    }

    if (anthropicApiKey) {
      return await handleAnthropic(messages, anthropicApiKey, extractedContext);
    }

    if (geminiApiKey) {
      return await handleGemini(messages, geminiApiKey, extractedContext);
    }

    // Fallback if requested provider not available
    if (selectedProvider !== "auto" && selectedProvider !== "fallback") {
      return new Response(JSON.stringify({ 
        error: `Requested provider "${selectedProvider}" is not configured. Please add the corresponding API key to your environment variables.` 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Final fallback
    return handleSimpleAI(messages);

  } catch (error) {
    console.error("Error in AI chat:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to process chat request",
      details: error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Simple rule-based AI fallback (no API key needed)
async function handleSimpleAI(messages) {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
  
  let response = "";
  let toolCalls = [];

  // Detect intent and suggest tools
  if (lastMessage.includes("deploy") || lastMessage.includes("repository") || lastMessage.includes("repo")) {
    response = "I can help you deploy a repository! I'll need the GitHub repository URL. You can provide it like: 'Deploy https://github.com/username/repo' or just tell me the URL.";
    
    // Try to extract repo URL
    const urlMatch = lastMessage.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      toolCalls.push({
        tool: "deploy_repository",
        arguments: { repoUrl: urlMatch[0] },
      });
    }
  } else if (lastMessage.includes("list") && (lastMessage.includes("deployment") || lastMessage.includes("deploy"))) {
    response = "Let me list your deployments for you.";
    toolCalls.push({
      tool: "list_deployments",
      arguments: {},
    });
  } else if (lastMessage.includes("list") && (lastMessage.includes("instance") || lastMessage.includes("ec2"))) {
    response = "Let me list your EC2 instances for you.";
    toolCalls.push({
      tool: "list_instances",
      arguments: {},
    });
  } else if (lastMessage.includes("scale") || lastMessage.includes("autoscale")) {
    response = "I can help you scale your application! I'll need the instance ID. You can say something like 'Scale instance inst_abc123 with min 2 and max 5'.";
    
    // Try to extract instance ID
    const instanceMatch = lastMessage.match(/inst[_\w]+/i);
    if (instanceMatch) {
      const minMatch = lastMessage.match(/min[:\s]+(\d+)/i);
      const maxMatch = lastMessage.match(/max[:\s]+(\d+)/i);
      toolCalls.push({
        tool: "scale_application",
        arguments: {
          instanceId: instanceMatch[0],
          minSize: minMatch ? parseInt(minMatch[1]) : 1,
          maxSize: maxMatch ? parseInt(maxMatch[1]) : 3,
        },
      });
    }
  } else if (lastMessage.includes("volume") || lastMessage.includes("storage") || lastMessage.includes("increase")) {
    response = "I can help you increase instance storage! I'll need the instance ID and how many GB to add. For example: 'Increase volume for inst_abc123 by 20GB'.";
    
    const instanceMatch = lastMessage.match(/inst[_\w]+/i);
    const gbMatch = lastMessage.match(/(\d+)\s*gb/i);
    if (instanceMatch && gbMatch) {
      toolCalls.push({
        tool: "increase_volume",
        arguments: {
          instanceId: instanceMatch[0],
          additionalGB: parseInt(gbMatch[1]),
        },
      });
    }
  } else if (lastMessage.includes("status") || lastMessage.includes("check")) {
    response = "I can check deployment status for you! I'll need the deployment ID.";
    
    const deploymentMatch = lastMessage.match(/deploy[_\w]+/i);
    if (deploymentMatch) {
      toolCalls.push({
        tool: "get_deployment_status",
        arguments: { deploymentId: deploymentMatch[0] },
      });
    }
  } else {
    response = "I'm here to help you with DeployEase! I can:\n- Deploy repositories to AWS EC2\n- List your deployments and instances\n- Scale your applications\n- Increase instance storage\n- Check deployment status\n\nWhat would you like to do?";
  }

  return new Response(JSON.stringify({
    response,
    toolCalls,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// OpenAI integration with intelligent tool chaining
async function handleOpenAI(messages, apiKey, extractedContext = null) {
  // Get session token for tool execution
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("next-auth.session-token")?.value || 
                      cookieStore.get("__Secure-next-auth.session-token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const config = { apiUrl, apiKey: null, sessionToken };

  // Use provided context or extract from messages
  if (!extractedContext) {
    extractedContext = extractContextFromMessages(messages);
  }
  
  // Build context-aware system prompt
  let contextPrompt = SYSTEM_PROMPT;
  if (extractedContext.instances.size > 0 || extractedContext.deployments.size > 0) {
    contextPrompt += "\n\n**Current Context (Remember this for this conversation):**\n";
    if (extractedContext.instances.size > 0) {
      contextPrompt += `- Known Instance IDs: ${Array.from(extractedContext.instances.keys()).join(", ")}\n`;
    }
    if (extractedContext.deployments.size > 0) {
      contextPrompt += `- Known Deployment IDs: ${Array.from(extractedContext.deployments.keys()).join(", ")}\n`;
    }
    contextPrompt += "\nUse these IDs when the user refers to 'my instance' or 'my deployment' without specifying the exact ID.\n";
  }

  // Build conversation with system prompt
  const conversationMessages = [
    { role: "system", content: contextPrompt },
    ...messages,
  ];

  // Maximum iterations to prevent infinite loops
  const maxIterations = 10;
  let iterations = 0;
  let finalResponse = null;
  let allToolCalls = [];

  while (iterations < maxIterations) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: conversationMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.7,
      }),
    });



    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI API error");
    }

    const message = data.choices[0].message;
    
    // Add assistant message to conversation
    conversationMessages.push(message);

    // If no tool calls, we're done
    if (!message.tool_calls || message.tool_calls.length === 0) {
      finalResponse = message.content || "I've completed the operations.";
      break;
    }

    // Execute all tool calls
    const toolCallResults = [];
    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);
      
      // Track tool call for frontend
      allToolCalls.push({
        tool: toolName,
        arguments: toolArgs,
        id: toolCall.id,
      });

      try {
        // Execute the tool
        const toolResult = await executeMCPTool(toolName, toolArgs, config);
        
        // Format tool result for OpenAI
        const resultText = toolResult.content?.[0]?.text || JSON.stringify(toolResult);
        const isError = toolResult.isError || false;

        toolCallResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: isError ? `Error: ${resultText}` : resultText,
        });
      } catch (error) {
        toolCallResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Error executing ${toolName}: ${error.message}`,
        });
      }
    }

    // Add tool results to conversation for next iteration
    conversationMessages.push(...toolCallResults);
    iterations++;
  }

  // If we hit max iterations, get a final response
  if (iterations >= maxIterations && !finalResponse) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [...conversationMessages, {
          role: "user",
          content: "Please provide a summary of what was accomplished."
        }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      finalResponse = data.choices[0].message.content || "Operations completed.";
    } else {
      finalResponse = "Completed multiple operations. Check the results above.";
    }
  }

  return new Response(JSON.stringify({
    response: finalResponse || "Operations completed.",
    toolCalls: allToolCalls,
    requiresToolExecution: false, // Already executed
    iterations,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// Anthropic (Claude) integration with intelligent tool chaining
async function handleAnthropic(messages, apiKey, extractedContext = null) {
  // Get session token for tool execution
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("next-auth.session-token")?.value || 
                      cookieStore.get("__Secure-next-auth.session-token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const config = { apiUrl, apiKey: null, sessionToken };

  // Use provided context or extract from messages
  if (!extractedContext) {
    extractedContext = extractContextFromMessages(messages);
  }
  
  // Build context-aware system prompt
  let contextPrompt = SYSTEM_PROMPT;
  if (extractedContext.instances.size > 0 || extractedContext.deployments.size > 0) {
    contextPrompt += "\n\n**Current Context (Remember this for this conversation):**\n";
    if (extractedContext.instances.size > 0) {
      contextPrompt += `- Known Instance IDs: ${Array.from(extractedContext.instances.keys()).join(", ")}\n`;
    }
    if (extractedContext.deployments.size > 0) {
      contextPrompt += `- Known Deployment IDs: ${Array.from(extractedContext.deployments.keys()).join(", ")}\n`;
    }
    contextPrompt += "\nUse these IDs when the user refers to 'my instance' or 'my deployment' without specifying the exact ID.\n";
  }

  // Convert messages to Anthropic format (system message is separate)
  const systemMessage = { role: "system", content: contextPrompt };
  const conversationMessages = [...messages];

  // Maximum iterations to prevent infinite loops
  const maxIterations = 10;
  let iterations = 0;
  let finalResponse = null;
  let allToolCalls = [];

  // Convert TOOL_DEFINITIONS to Anthropic format
  const anthropicTools = TOOL_DEFINITIONS.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }));

  while (iterations < maxIterations) {
    // Prepare messages for Anthropic API
    const anthropicMessages = [];
    
    for (const msg of conversationMessages) {
      if (msg.role === "system") continue;
      
      if (msg.role === "tool") {
        // Anthropic uses user role with tool_result content
        anthropicMessages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: msg.tool_call_id,
            content: msg.content,
          }]
        });
      } else if (msg.role === "assistant" && msg.tool_calls) {
        // Convert tool calls to Anthropic format
        anthropicMessages.push({
          role: "assistant",
          content: msg.tool_calls.map(tc => ({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: typeof tc.function.arguments === "string" 
              ? JSON.parse(tc.function.arguments) 
              : tc.function.arguments,
          })),
        });
      } else if (msg.role === "assistant" && msg.content) {
        // Regular assistant text response
        anthropicMessages.push({
          role: "assistant",
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        });
      } else if (msg.role === "user") {
        // User messages
        anthropicMessages.push({
          role: "user",
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        });
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022", // Latest Claude model
        max_tokens: 4096,
        system: systemMessage.content,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Anthropic API error: ${response.statusText}`);
    }

    const assistantContent = data.content || [];
    const toolUses = assistantContent.filter(item => item.type === "tool_use");
    
    // If there are tool uses, execute them
    if (toolUses.length > 0) {
      // Store assistant message with tool uses
      conversationMessages.push({
        role: "assistant",
        content: assistantContent,
        tool_calls: toolUses.map(tu => ({
          id: tu.id,
          function: {
            name: tu.name,
            arguments: JSON.stringify(tu.input),
          },
        })),
      });

      // Execute all tool calls
      const toolCallResults = [];
      for (const toolUse of toolUses) {
        const toolName = toolUse.name;
        const toolArgs = toolUse.input;
        
        // Track tool call for frontend
        allToolCalls.push({
          tool: toolName,
          arguments: toolArgs,
          id: toolUse.id,
        });

        try {
          // Execute the tool
          const toolResult = await executeMCPTool(toolName, toolArgs, config);
          
          // Format tool result
          const resultText = toolResult.content?.[0]?.text || JSON.stringify(toolResult);
          const isError = toolResult.isError || false;

          toolCallResults.push({
            role: "tool",
            tool_call_id: toolUse.id,
            content: isError ? `Error: ${resultText}` : resultText,
          });
        } catch (error) {
          toolCallResults.push({
            role: "tool",
            tool_call_id: toolUse.id,
            content: `Error executing ${toolName}: ${error.message}`,
          });
        }
      }

      // Add tool results to conversation
      conversationMessages.push(...toolCallResults);
      iterations++;
      continue;
    }

    // Text response (no tools) - extract text from content array
    const textParts = assistantContent
      .filter(item => item.type === "text")
      .map(item => item.text);
    
    finalResponse = textParts.join("\n") || "I've completed the operations.";
    break;
  }

  // If we hit max iterations, get a final response
  if (iterations >= maxIterations && !finalResponse) {
    finalResponse = "Completed multiple operations. Check the results above.";
  }

  return new Response(JSON.stringify({
    response: finalResponse || "Operations completed.",
    toolCalls: allToolCalls,
    requiresToolExecution: false, // Already executed
    iterations,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// Gemini integration with intelligent tool chaining
async function handleGemini(messages, apiKey, extractedContext = null) {
  // Get session token for tool execution
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("next-auth.session-token")?.value || 
                      cookieStore.get("__Secure-next-auth.session-token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const config = { apiUrl, apiKey: null, sessionToken };

  // Use provided context or extract from messages
  if (!extractedContext) {
    extractedContext = extractContextFromMessages(messages);
  }
  
  // Build context-aware system prompt
  let contextPrompt = SYSTEM_PROMPT;
  if (extractedContext.instances.size > 0 || extractedContext.deployments.size > 0) {
    contextPrompt += "\n\n**Current Context (Remember this for this conversation):**\n";
    if (extractedContext.instances.size > 0) {
      contextPrompt += `- Known Instance IDs: ${Array.from(extractedContext.instances.keys()).join(", ")}\n`;
    }
    if (extractedContext.deployments.size > 0) {
      contextPrompt += `- Known Deployment IDs: ${Array.from(extractedContext.deployments.keys()).join(", ")}\n`;
    }
    contextPrompt += "\nUse these IDs when the user refers to 'my instance' or 'my deployment' without specifying the exact ID.\n";
  }

  // Convert TOOL_DEFINITIONS to Gemini function declaration format
  const geminiFunctions = TOOL_DEFINITIONS.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));

  // Build conversation history for Gemini
  const conversationHistory = [];
  let systemInstruction = contextPrompt;

  // Maximum iterations to prevent infinite loops
  const maxIterations = 10;
  let iterations = 0;
  let finalResponse = null;
  let allToolCalls = [];
  let toolCallMap = new Map(); // Map tool_call_id to tool name for function responses

  // Convert messages to Gemini format
  function convertToGeminiFormat(messages) {
    const geminiContents = [];
    
    for (const msg of messages) {
      if (msg.role === "system") {
        // System messages become system instructions (handled separately)
        systemInstruction = msg.content || contextPrompt;
        continue;
      }

      if (msg.role === "user") {
        geminiContents.push({
          role: "user",
          parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }]
        });
      } else if (msg.role === "assistant") {
        const parts = [];
        
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Assistant made function calls
          msg.tool_calls.forEach(tc => {
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: typeof tc.function.arguments === "string" 
                  ? JSON.parse(tc.function.arguments) 
                  : tc.function.arguments,
              }
            });
          });
        } else if (msg.content) {
          // Assistant text response
          parts.push({ 
            text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) 
          });
        }
        
        if (parts.length > 0) {
          geminiContents.push({
            role: "model",
            parts: parts
          });
        }
      } else if (msg.role === "tool") {
        // Tool responses - Gemini uses "function" role for function responses
        // Extract function name from tool_call_id pattern or use the stored map
        let toolName = "unknown";
        if (msg.tool_call_id) {
          toolName = toolCallMap.get(msg.tool_call_id) || 
                     msg.tool_call_id.split("-")[0] || 
                     "unknown";
        }
        
        // Gemini requires response to be a Struct (object), not a string
        // If it's already an object, use it; otherwise wrap it
        let responseObject;
        if (typeof msg.content === "string") {
          try {
            // Try to parse as JSON first
            responseObject = JSON.parse(msg.content);
          } catch {
            // If not JSON, wrap it in an object
            responseObject = {
              text: msg.content
            };
          }
        } else if (typeof msg.content === "object") {
          responseObject = msg.content;
        } else {
          responseObject = {
            text: String(msg.content)
          };
        }
        
        geminiContents.push({
          role: "function",
          parts: [{
            functionResponse: {
              name: toolName,
              response: responseObject
            }
          }]
        });
      }
    }

    return geminiContents;
  }

  // Build initial conversation
  const geminiMessages = convertToGeminiFormat(messages);

  while (iterations < maxIterations) {
    try {
      // Prepare request body for Gemini API
      const requestBody = {
        contents: geminiMessages,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        tools: geminiFunctions.length > 0 ? [{
          functionDeclarations: geminiFunctions
        }] : undefined,
      };

      // Remove undefined fields
      if (!requestBody.tools || requestBody.tools.length === 0) {
        delete requestBody.tools;
      }

      // Gemini API endpoint - using gemini-1.5-flash which supports function calling
      const modelName = "gemini-2.5-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `Gemini API error: ${response.statusText}`);
      }

      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error("No response candidate from Gemini");
      }

      const content = candidate.content?.parts || [];
      const functionCalls = content.filter(part => part.functionCall);
      
      // If there are function calls, execute them
      if (functionCalls.length > 0) {
        // Add model response with function calls to conversation history
        const modelResponseParts = functionCalls.map(fc => ({
          functionCall: {
            name: fc.functionCall.name,
            args: fc.functionCall.args || {}
          }
        }));
        
        geminiMessages.push({
          role: "model",
          parts: modelResponseParts
        });

        // Track and execute tool calls
        const toolCallResults = [];
        for (const funcCall of functionCalls) {
          const toolName = funcCall.functionCall.name;
          const toolArgs = funcCall.functionCall.args || {};
          const callId = `${toolName}-${iterations}-${Date.now()}`;

          // Store mapping for function response matching
          toolCallMap.set(callId, toolName);

          // Track tool call for frontend
          allToolCalls.push({
            tool: toolName,
            arguments: toolArgs,
            id: callId,
          });

          try {
            // Execute the tool
            const toolResult = await executeMCPTool(toolName, toolArgs, config);
            
            // Format tool result
            const resultText = toolResult.content?.[0]?.text || JSON.stringify(toolResult);
            const isError = toolResult.isError || false;

            // Gemini requires functionResponse.response to be a Struct (JSON object), not a string
            // Wrap the response in an object
            const responseObject = {
              text: isError ? `Error: ${resultText}` : resultText,
              success: !isError,
              ...(isError && { error: resultText })
            };

            // Add function response to history (Gemini uses "function" role)
            geminiMessages.push({
              role: "function",
              parts: [{
                functionResponse: {
                  name: toolName,
                  response: responseObject
                }
              }]
            });

            toolCallResults.push({
              role: "tool",
              tool_call_id: callId,
              content: isError ? `Error: ${resultText}` : resultText,
            });
          } catch (error) {
            // Error response must also be a Struct
            const errorResponseObject = {
              text: `Error executing ${toolName}: ${error.message}`,
              success: false,
              error: error.message
            };

            geminiMessages.push({
              role: "function",
              parts: [{
                functionResponse: {
                  name: toolName,
                  response: errorResponseObject
                }
              }]
            });
            
            toolCallResults.push({
              role: "tool",
              tool_call_id: callId,
              content: `Error executing ${toolName}: ${error.message}`,
            });
          }
        }

        iterations++;
        continue;
      }

      // Text response (no function calls)
      const textParts = content
        .filter(part => part.text)
        .map(part => part.text);
      
      finalResponse = textParts.join("\n") || "I've completed the operations.";
      break;

    } catch (error) {
      console.error("Gemini API error:", error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  // If we hit max iterations, get a final response
  if (iterations >= maxIterations && !finalResponse) {
    finalResponse = "Completed multiple operations. Check the results above.";
  }

  return new Response(JSON.stringify({
    response: finalResponse || "Operations completed.",
    toolCalls: allToolCalls,
    requiresToolExecution: false, // Already executed
    iterations,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

