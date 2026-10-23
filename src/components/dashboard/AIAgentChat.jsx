"use client";
import { io as socketClient } from "socket.io-client";
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
  FiRefreshCw,
  FiChevronDown,
  FiCheck
} from "react-icons/fi";
import toast from "react-hot-toast";
import { FaRobot } from "react-icons/fa";
import { useSession } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

export default function AIAgentChat() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState([]);
  const logsRef = useRef(null);

  


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
  const [selectedProvider, setSelectedProvider] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

useEffect(() => {
  const textarea = inputRef.current;
  if (textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }
}, [input]);
  useEffect(() => {
    // Check AI provider status
    fetch("/api/mcp/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAiStatus(data);
          // Set default provider from localStorage or use default from API
          const savedProvider = localStorage.getItem("deployease_ai_provider");
          if (savedProvider && data.providers?.some(p => p.id === savedProvider)) {
            setSelectedProvider(savedProvider);
          } else {
            const defaultProvider = data.defaultProvider || data.providers?.[0]?.id;
            setSelectedProvider(defaultProvider);
            // Save default to localStorage if not already set
            if (defaultProvider && !savedProvider) {
              localStorage.setItem("deployease_ai_provider", defaultProvider);
            }
          }
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
      // Call AI agent API with selected provider
      // Use selectedProvider or fallback to default from aiStatus
      const providerToUse = selectedProvider || aiStatus?.defaultProvider || "auto";

      const response = await fetch("/api/mcp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, newUserMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          provider: providerToUse, // Send selected provider
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get AI response");
      }

      // Check if tools were already executed server-side (intelligent chaining)
      if (data.requiresToolExecution === false && data.toolCalls && data.toolCalls.length > 0) {
        // Tools were executed server-side, show them as completed
        setMessages(prev => [
          ...prev,
          {
            role: "system",
            content: `🔧 Executed ${data.toolCalls.length} operation(s)${data.iterations > 1 ? ` across ${data.iterations} iteration(s)` : ''}...`,
            timestamp: new Date(),
          },
        ]);

        // Show each tool execution (they're already done, just for visibility)
        for (let i = 0; i < data.toolCalls.length; i++) {
          setMessages(prev => [
            ...prev,
            {
              role: "system",
              content: `✅ Completed: ${data.toolCalls[i].tool}`,
              timestamp: new Date(),
              isCompleted: true,
            },
          ]);
        }
      }

      // Add assistant response
      const assistantMessage = {
        role: "assistant",
        content: data.response,
        toolCalls: data.toolCalls || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If tools need to be executed client-side (fallback mode)
      if (data.requiresToolExecution !== false && data.toolCalls && data.toolCalls.length > 0) {
        const totalTools = data.toolCalls.length;

        // Show summary for multi-tool operations
        if (totalTools > 1) {
          setMessages(prev => [
            ...prev,
            {
              role: "system",
              content: `🔧 Planning ${totalTools} operations to complete your request...`,
              timestamp: new Date(),
            },
          ]);
        }

        for (let i = 0; i < data.toolCalls.length; i++) {
          await executeToolCall(data.toolCalls[i], i, totalTools);
        }

        // After all tools are executed
        if (totalTools > 1) {
          setMessages(prev => [
            ...prev,
            {
              role: "assistant",
              content: "✅ All operations completed. Review the results above.",
              timestamp: new Date(),
            },
          ]);
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

  const executeToolCall = async (toolCall, index = 0, total = 1) => {
    const { tool, arguments: args } = toolCall;

    // Show progress for multi-step operations
    const progressMsg = total > 1
      ? `🔧 Step ${index + 1}/${total}: Executing ${tool}...`
      : `🔧 Executing: ${tool}...`;

    setMessages(prev => [
      ...prev,
      { role: "system", content: progressMsg, timestamp: new Date() }
    ]);

    try {
      const response = await fetch("/api/mcp/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, arguments: args })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tool execution failed");

      let resultText = "";
      if (data.result) {
        if (Array.isArray(data.result)) {
          resultText = data.result.map(i => i.text || JSON.stringify(i)).join("\n");
        } else if (typeof data.result === "string") {
          resultText = data.result;
        } else {
          resultText = JSON.stringify(data.result, null, 2);
        }
      } else if (data.isError) {
        throw new Error(resultText || "Tool execution failed");
      }

      // Only show result if it's meaningful (not empty)
      if (resultText.trim()) {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: resultText,
            isToolResult: true,
            toolName: tool,
            timestamp: new Date()
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Error executing ${tool}: ${err.message}`,
          isError: true,
          toolName: tool,
          timestamp: new Date()
        }
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


  // for loging  const [logs, setLogs] = useState([]);  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!session) return;
    const socket = socketClient(SOCKET_URL);
    socket.on("connect", () => socket.emit("join-room", session.user.id));
    socket.on("deploy-log", (msg) => setLogs((prev) => [...prev, msg]));
    return () => socket.disconnect();
  }, [session]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);



  return (
    <section className="overflow-hidden">

      <Card className="max-h-[90vh] flex flex-col overflow-y-auto">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <FaRobot size={20} className="text-black" />
              <CardTitle>DeployEase AI Assistant</CardTitle>

              {/* AI Provider Selector - Always visible and changeable */}
              {aiStatus && aiStatus.providers && aiStatus.providers.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs h-8 min-w-[140px]"
                      disabled={loading}
                    >
                      <span>
                        {(() => {
                          const currentProvider = aiStatus.providers.find(
                            p => p.id === (selectedProvider || aiStatus.defaultProvider || aiStatus.providers[0]?.id)
                          );
                          return currentProvider?.icon || "🤖";
                        })()}
                      </span>
                      <span className="hidden sm:inline truncate">
                        {(() => {
                          const currentProvider = aiStatus.providers.find(
                            p => p.id === (selectedProvider || aiStatus.defaultProvider || aiStatus.providers[0]?.id)
                          );
                          return currentProvider?.displayName || "Select AI";
                        })()}
                      </span>
                      <FiChevronDown size={12} className="ml-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 z-50">
                    <DropdownMenuLabel>Choose AI Provider</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {aiStatus.providers.map((provider) => {
                      const isSelected = provider.id === (selectedProvider || aiStatus.defaultProvider || aiStatus.providers[0]?.id);
                      return (
                        <DropdownMenuItem
                          key={provider.id}
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedProvider(provider.id);
                            localStorage.setItem("deployease_ai_provider", provider.id);
                            toast.success(`Switched to ${provider.displayName}`);
                          }}
                          className="cursor-pointer"
                          disabled={isSelected && aiStatus.providers.length === 1}
                        >
                          <span className="mr-2 text-lg">{provider.icon}</span>
                          <span className="flex-1 font-medium">{provider.displayName}</span>
                          {isSelected && (
                            <FiCheck size={14} className="text-blue-600 ml-2" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={clearChat} title="Clear chat">
              <FiRefreshCw size={14} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-4 min-h-0 p-0">
          {/* Deployment Logs */}
          {/* <Accordion type="single" collapsible>
                <AccordionItem value="logs">
                  <AccordionTrigger>Deployment Logs</AccordionTrigger>
                  <AccordionContent>
                    <div ref={logsRef} className="h-60 overflow-y-auto text-xs font-mono space-y-1 bg-black text-white p-2 rounded">
                      {logs.map((log, i) => (<p key={i}>{log}</p>))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion> */}
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <FaRobot size={16} className="text-black dark:text-blue-400" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === "user"
                      ? "bg-gray-500 text-white"
                      : message.isError
                        ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                        : message.isToolResult
                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                          : message.isCompleted
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
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
                    {message.isToolResult && message.toolName && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-green-200 dark:border-green-800">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                          {message.toolName.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-green-600 dark:text-green-500">✓ Executed</span>
                      </div>
                    )}
                    {message.isCompleted && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                          Completed
                        </span>
                      </div>
                    )}
                    <div className={`whitespace-pre-wrap break-words text-sm ${message.isToolResult ? "font-mono text-xs" : ""
                      }`}>
                      {message.content}
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      {/* <FiUser size={16} className="text-gray-600 dark:text-gray-300" /> */}
                       <img src={session.user.image} alt="" className="h-8 w-8 rounded-full"/>
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
                  <FaRobot size={16} className="text-black dark:text-blue-400 animate-pulse" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <FiLoader className="animate-spin" size={14} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Analyzing and planning operations...
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    The AI is working as your DevOps engineer
                  </p>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4 bg-white">
            <div className="max-w-4xl mx-auto w-full">
              <div className="flex items-end gap-2 bg-gray-100 rounded-xl p-3 shadow-sm">

                {/* Textarea (ChatGPT style) */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message DeployEase..."
                  disabled={loading}
                  rows={1}
                  className="
          flex-1 bg-transparent resize-none border-0 focus:outline-none 
          max-h-40 overflow-y-auto text-sm
        "
                />

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="rounded-full h-10 w-10 flex items-center justify-center"
                >
                  {loading ? (
                    <FiLoader className="animate-spin" size={18} />
                  ) : (
                    <FiSend size={18} />
                  )}
                </Button>
              </div>

              {/* small footer like ChatGPT */}
              <p className="text-xs text-center text-gray-400 mt-2">
                DeployEase AI may run real commands on your EC2 instance.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>


    </section>
  );
}

