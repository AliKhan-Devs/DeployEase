import { getAuthSession } from "@/lib/authSession";

const SYSTEM_PROMPT = `You are DeployEase AI Assistant, a helpful AI agent that helps users deploy and manage applications on AWS EC2 through the DeployEase platform.

Your capabilities:
1. **Deploy Repositories**: Deploy GitHub repositories to AWS EC2 instances
2. **Manage Instances**: List, view, and manage EC2 instances
3. **Scale Applications**: Enable auto-scaling for applications
4. **Manage Storage**: Increase instance volumes
5. **Monitor Deployments**: Check deployment status and logs

When users ask you to do something:
- Be friendly, helpful, and conversational
- Ask clarifying questions if needed (like repository URL, instance ID, etc.)
- Use the available tools to execute actions
- Explain what you're doing in simple terms
- Provide clear feedback on success or errors

Available tools:
- deploy_repository: Deploy a GitHub repo (needs repoUrl, optional: branch, appType, instanceType, region, accessKeyId, secretAccessKey, targetInstanceId, envVars)
- list_deployments: List all deployments (optional: instanceId filter)
- list_instances: List all EC2 instances
- get_deployment_status: Get status of a deployment (needs deploymentId)
- scale_application: Enable auto-scaling (needs instanceId, optional: minSize, maxSize)
- increase_volume: Increase instance storage (needs instanceId, additionalGB)

Always be helpful and guide users through the process. If you don't have enough information, ask for it before executing actions.`;

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
          targetInstanceId: { type: "string", description: "Existing instance ID to deploy to" },
          accessKeyId: { type: "string", description: "AWS access key ID" },
          secretAccessKey: { type: "string", description: "AWS secret access key" },
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
    const { messages } = body;

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

    if (!openaiApiKey && !anthropicApiKey && !geminiApiKey) {
      // Fallback: Simple rule-based response with tool detection
      return handleSimpleAI(messages);
    }

    // Use OpenAI if available
    if (openaiApiKey) {
      return await handleOpenAI(messages, openaiApiKey);
    }

    // Use Anthropic if available
    if (anthropicApiKey) {
      return await handleAnthropic(messages, anthropicApiKey);
    }

    // Use Gemini if available
    if (geminiApiKey) {
      return await handleGemini(messages, geminiApiKey);
    }

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

// OpenAI integration
async function handleOpenAI(messages, apiKey) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // or "gpt-3.5-turbo" for cheaper option
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
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
  const toolCalls = message.tool_calls?.map((tc) => ({
    tool: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
  })) || [];

  return new Response(JSON.stringify({
    response: message.content || "I'll help you with that!",
    toolCalls,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// Anthropic (Claude) integration
async function handleAnthropic(messages, apiKey) {
  // Anthropic API implementation would go here
  // For now, fallback to simple AI
  return handleSimpleAI(messages);
}

// Gemini integration
async function handleGemini(messages, apiKey) {
  // Gemini API implementation would go here
  // For now, fallback to simple AI
  return handleSimpleAI(messages);
}

