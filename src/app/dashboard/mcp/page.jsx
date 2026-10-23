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
    <section className="space-y-6 max-w-5xl mx-auto overflow-hidden">

      {/* AI Agent Chat - Main Interface */}
          <AIAgentChat />
        

    </section>
  );
}

