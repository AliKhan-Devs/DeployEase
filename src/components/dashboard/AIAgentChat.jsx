"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FiSend,  
  FiUser,
  FiLoader,
  FiRefreshCw
} from "react-icons/fi";
import toast from "react-hot-toast";
import { FaRobot } from "react-icons/fa";

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

export default function AIAgentChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 Hello! I'm your DeployEase AI Assistant. I can help you deploy applications, manage instances, scale your apps, and more. What would you like to do today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Check AI provider status
    fetch("/api/mcp/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAiStatus(data);
        }
      })
      .catch((err) => console.error("Failed to fetch AI status:", err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message
    const newUserMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      // Call AI agent API
      const response = await fetch("/api/mcp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, newUserMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get AI response");
      }

      // Add assistant response
      const assistantMessage = {
        role: "assistant",
        content: data.response,
        toolCalls: data.toolCalls || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If there are tool calls, execute them
      if (data.toolCalls && data.toolCalls.length > 0) {
        for (const toolCall of data.toolCalls) {
          await executeToolCall(toolCall);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
          timestamp: new Date(),
        },
      ]);
      toast.error("Failed to get AI response");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const executeToolCall = async (toolCall) => {
    const { tool, arguments: args } = toolCall;

    // Add tool execution message
    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        content: `🔧 Executing: ${tool}...`,
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await fetch("/api/mcp/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, arguments: args }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Tool execution failed");
      }

      // Extract result text
      let resultText = "";
      if (data.result) {
        if (Array.isArray(data.result)) {
          resultText = data.result
            .map((item) => (item.type === "text" ? item.text : JSON.stringify(item)))
            .join("\n");
        } else if (typeof data.result === "string") {
          resultText = data.result;
        } else {
          resultText = JSON.stringify(data.result, null, 2);
        }
      }

      // Add result message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: resultText,
          isToolResult: true,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Error executing ${tool}: ${error.message}`,
          isError: true,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "👋 Hello! I'm your DeployEase AI Assistant. I can help you deploy applications, manage instances, scale your apps, and more. What would you like to do today?",
        timestamp: new Date(),
      },
    ]);
    toast.success("Chat cleared");
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaRobot size={20} className="text-blue-600" />
            <CardTitle>DeployEase AI Assistant</CardTitle>
            {aiStatus && (
              <Badge 
                variant={aiStatus.hasApiKey ? "default" : "outline"} 
                className={`text-xs ${aiStatus.hasApiKey ? "bg-green-600" : ""}`}
              >
                {aiStatus.providerName}
              </Badge>
            )}
          </div>
            <Button size="sm" variant="outline" onClick={clearChat}>
              <FiRefreshCw size={14} />
            </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0 p-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <FaRobot size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : message.isError
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                      : message.isToolResult
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {message.role === "user" && (
                    <div className="flex items-center gap-2 mb-1">
                      <FiUser size={14} />
                      <span className="text-xs font-semibold">You</span>
                    </div>
                  )}
                  {message.role === "system" && (
                    <div className="flex items-center gap-2 mb-1">
                      <FiLoader className="animate-spin" size={14} />
                      <span className="text-xs font-semibold">System</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-sm">
                    {message.content}
                  </div>
                  <div className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <FiUser size={16} className="text-gray-600 dark:text-gray-300" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 justify-start"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <FaRobot size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <FiLoader className="animate-spin" size={14} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Thinking...
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about deploying or managing your apps..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="flex items-center gap-2"
            >
              {loading ? (
                <FiLoader className="animate-spin" size={16} />
              ) : (
                <FiSend size={16} />
              )}
              Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Try: "Deploy my repository", "List my instances", "Scale my app", etc.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

