"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FiCopy, FiCheck, FiExternalLink, FiTerminal, FiSettings, FiInfo } from "react-icons/fi";
import { SiOpenai } from "react-icons/si";
import toast from "react-hot-toast";
import Loading from "@/app/loading";
import MCPTerminal from "@/components/dashboard/MCPTerminal";
import AIAgentChat from "@/components/dashboard/AIAgentChat";

export default function MCPIntegrationPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState({});

  useEffect(() => {
    document.title = "AI Integration (MCP) - DeployEase";
    
    async function fetchConfig() {
      try {
        const res = await fetch("/api/mcp/config");
        const data = await res.json();
        
        if (data.success) {
          setConfig(data.config);
        } else {
          toast.error("Failed to load MCP configuration");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error loading configuration");
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ ...copied, [key]: true });
      toast.success("Copied to clipboard!");
      setTimeout(() => {
        setCopied({ ...copied, [key]: false });
      }, 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return <Loading message="Loading MCP configuration..." />;
  }

  if (!config) {
    return (
      <Alert className="mt-6">
        Failed to load MCP configuration. Please refresh the page.
      </Alert>
    );
  }

  const apiUrl = config.apiUrl || "http://localhost:3000";
  const sessionToken = config.sessionToken || "YOUR_SESSION_TOKEN";
  const hasSessionToken = config.hasSessionToken;

  // MCP Server configuration for Claude Desktop
  const claudeDesktopConfig = {
    mcpServers: {
      deployease: {
        command: "node",
        args: ["./mcp-server/index.js"],
        env: {
          DEPLOYEASE_API_URL: apiUrl,
          DEPLOYEASE_SESSION_TOKEN: sessionToken,
        }
      }
    }
  };

  // Environment variables for MCP server
  const envExample = `DEPLOYEASE_API_URL=${apiUrl}
DEPLOYEASE_SESSION_TOKEN=${sessionToken}`;

  return (
    <section className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <SiOpenai size={32} className="text-gray-900 dark:text-white" />
          <h1 className="text-3xl font-bold">AI Integration (MCP)</h1>
        </div>
        <p className="text-muted-foreground">
          Connect AI agents to DeployEase using Model Context Protocol (MCP)
        </p>
      </motion.div>

      {/* Status Alert */}
      {!hasSessionToken && (
        <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <FiInfo className="mr-2" />
          <span>
            Session token not available. Please ensure you're logged in. 
            You may need to refresh the page after logging in.
          </span>
        </Alert>
      )}

      {/* AI Provider Configuration Alert */}
      <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <FiInfo className="mr-2" />
        <div>
          <p className="font-semibold mb-1">💡 Enhanced AI Experience</p>
          <p className="text-sm">
            For the best AI experience, configure an AI provider API key in your environment variables:
            <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded ml-1">OPENAI_API_KEY</code>, 
            <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded ml-1">ANTHROPIC_API_KEY</code>, or 
            <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded ml-1">GEMINI_API_KEY</code>.
            Without an API key, the AI will use a simple rule-based system that still works but is less intelligent.
          </p>
        </div>
      </Alert>

      {/* What is MCP */}
      <Card>
        <CardHeader>
          <CardTitle>What is MCP?</CardTitle>
          <CardDescription>
            Model Context Protocol enables AI assistants to interact with DeployEase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            The MCP server allows AI agents (like Claude, ChatGPT, etc.) to perform actions on your behalf:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Deploy GitHub repositories to AWS EC2</li>
            <li>Scale applications with auto-scaling groups</li>
            <li>Increase instance storage volumes</li>
            <li>List and manage deployments</li>
            <li>Check deployment status</li>
          </ul>
        </CardContent>
      </Card>

      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Set up your MCP server to connect AI agents to DeployEase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">API URL</label>
            <div className="flex gap-2">
              <Input 
                value={apiUrl} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(apiUrl, "apiUrl")}
              >
                {copied.apiUrl ? <FiCheck /> : <FiCopy />}
              </Button>
            </div>
          </div>

          {/* Session Token */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              Session Token
              {hasSessionToken ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Available
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  Not Found
                </Badge>
              )}
            </label>
            <div className="flex gap-2">
              <Input 
                value={sessionToken} 
                readOnly 
                type="password"
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(sessionToken, "sessionToken")}
              >
                {copied.sessionToken ? <FiCheck /> : <FiCopy />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This token authenticates the MCP server with your DeployEase account
            </p>
          </div>

          {/* Environment Variables */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Environment Variables (.env)</label>
            <div className="relative">
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border font-mono text-sm overflow-x-auto">
                {envExample}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(envExample, "env")}
              >
                {copied.env ? <FiCheck /> : <FiCopy />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiSettings size={20} />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1 */}
          <div className="space-y-2">
            <h3 className="font-semibold">Step 1: Install Dependencies</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border">
              <pre className="font-mono text-sm">
{`cd mcp-server
npm install`}
              </pre>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <h3 className="font-semibold">Step 2: Configure Environment</h3>
            <p className="text-sm text-muted-foreground">
              Create a <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">.env</code> file in the <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">mcp-server</code> directory with the values above.
            </p>
          </div>

          {/* Step 3 - Claude Desktop */}
          <div className="space-y-2">
            <h3 className="font-semibold">Step 3: Configure Claude Desktop</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Add this configuration to your Claude Desktop config file. <strong>Important:</strong> Update the <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">args</code> path to point to your MCP server's <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">index.js</code> file.
            </p>
            <div className="relative">
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border font-mono text-sm overflow-x-auto">
                {JSON.stringify(claudeDesktopConfig, null, 2)}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(JSON.stringify(claudeDesktopConfig, null, 2), "claudeConfig")}
              >
                {copied.claudeConfig ? <FiCheck /> : <FiCopy />}
              </Button>
            </div>
            <Alert className="mt-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <FiInfo className="mr-2" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Path Configuration:</p>
                <p className="text-xs">
                  Replace <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">./mcp-server/index.js</code> with the absolute path to your MCP server, e.g., <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">/Users/yourname/projects/deployease/mcp-server/index.js</code>
                </p>
              </div>
            </Alert>
            <p className="text-xs text-muted-foreground mt-3">
              Config file location:
            </p>
            <ul className="text-xs text-muted-foreground ml-4 space-y-1">
              <li>• macOS: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
              <li>• Windows: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">%APPDATA%\Claude\claude_desktop_config.json</code></li>
              <li>• Linux: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">~/.config/Claude/claude_desktop_config.json</code></li>
            </ul>
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <h3 className="font-semibold">Step 4: Restart Claude Desktop</h3>
            <p className="text-sm text-muted-foreground">
              Restart Claude Desktop to load the new MCP server configuration.
            </p>
          </div>

          {/* Step 5 */}
          <div className="space-y-2">
            <h3 className="font-semibold">Step 5: Test the Connection</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Try asking Claude to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>"List my deployments"</li>
              <li>"Deploy my repository https://github.com/username/repo"</li>
              <li>"Scale my app on instance inst_abc123"</li>
              <li>"Increase volume for instance inst_abc123 by 20GB"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Available Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiTerminal size={20} />
            Available MCP Tools
          </CardTitle>
          <CardDescription>
            Tools that AI agents can use to interact with DeployEase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "deploy_repository", desc: "Deploy GitHub repositories to AWS EC2" },
              { name: "scale_application", desc: "Enable auto-scaling with load balancers" },
              { name: "increase_volume", desc: "Expand EC2 instance storage volumes" },
              { name: "list_deployments", desc: "View all your deployments" },
              { name: "list_instances", desc: "View all EC2 instances" },
              { name: "get_deployment_status", desc: "Check deployment status and logs" },
            ].map((tool) => (
              <div key={tool.name} className="p-3 border rounded-lg">
                <code className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {tool.name}
                </code>
                <p className="text-xs text-muted-foreground mt-1">{tool.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Agent Chat - Main Interface */}
      <Card className="h-[700px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiOpenai size={20} />
            AI Assistant Chat
          </CardTitle>
          <CardDescription>
            Talk to our AI assistant - it understands DeployEase and can help you deploy, manage, and scale your applications through natural conversation!
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] p-0">
          <AIAgentChat />
        </CardContent>
      </Card>

      {/* AI Agent Terminal - Advanced Users */}
      {/* <Card className="h-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiTerminal size={20} />
            Advanced: Command Terminal
          </CardTitle>
          <CardDescription>
            For advanced users: Use direct commands to interact with MCP tools
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] p-0">
          <MCPTerminal />
        </CardContent>
      </Card> */}

      {/* Documentation Link */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Need More Help?</h3>
              <p className="text-sm text-muted-foreground">
                Check out the MCP server documentation for detailed information
              </p>
            </div>
            <Button
              variant="outline"
              asChild
              className="flex items-center gap-2"
            >
              <a href="/mcp-server/README.md" target="_blank" rel="noopener noreferrer">
                View Docs
                <FiExternalLink size={16} />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

