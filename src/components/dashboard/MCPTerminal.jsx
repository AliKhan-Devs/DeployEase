"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FiSend, 
  FiTerminal, 
  FiX, 
  FiCheckCircle, 
  FiXCircle,
  FiLoader,
  FiHelpCircle
} from "react-icons/fi";
import toast from "react-hot-toast";

const AVAILABLE_TOOLS = [
  { name: "list_deployments", description: "List all deployments", example: "list_deployments" },
  { name: "list_instances", description: "List all EC2 instances", example: "list_instances" },
  { name: "get_deployment_status", description: "Get deployment status", example: "get_deployment_status --deploymentId <id>" },
  { name: "deploy_repository", description: "Deploy a repository", example: "deploy_repository --repoUrl <url> --branch main" },
  { name: "scale_application", description: "Scale an application", example: "scale_application --instanceId <id> --minSize 2 --maxSize 5" },
  { name: "increase_volume", description: "Increase instance volume", example: "increase_volume --instanceId <id> --additionalGB 20" },
];

export default function MCPTerminal() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const parseCommand = (cmd) => {
    const parts = cmd.trim().split(/\s+/);
    const tool = parts[0];
    const args = {};

    // Parse arguments (simple --key value format)
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].startsWith("--")) {
        const key = parts[i].substring(2);
        const value = parts[i + 1];
        if (value && !value.startsWith("--")) {
          // Try to parse as number if possible
          args[key] = isNaN(value) ? value : Number(value);
          i++; // Skip the value
        } else {
          args[key] = true; // Boolean flag
        }
      }
    }

    return { tool, arguments: args };
  };

  const handleExecute = async () => {
    if (!command.trim() || loading) return;

    const cmdText = command.trim();
    setCommand("");
    
    // Add command to history
    const commandEntry = {
      type: "command",
      text: cmdText,
      timestamp: new Date(),
    };
    setHistory((prev) => [...prev, commandEntry]);
    setLoading(true);

    try {
      // Parse command
      const { tool, arguments: args } = parseCommand(cmdText);

      // Execute via API
      const response = await fetch("/api/mcp/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, arguments: args }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute command");
      }

      // Extract text from result
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

      // Add result to history
      setHistory((prev) => [
        ...prev,
        {
          type: "result",
          text: resultText,
          isError: data.isError || false,
          timestamp: new Date(),
        },
      ]);

      if (data.isError) {
        toast.error("Command failed");
      } else {
        toast.success("Command executed successfully");
      }
    } catch (error) {
      console.error("Error executing command:", error);
      setHistory((prev) => [
        ...prev,
        {
          type: "result",
          text: `Error: ${error.message}`,
          isError: true,
          timestamp: new Date(),
        },
      ]);
      toast.error("Failed to execute command");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    }
  };

  const insertExample = (example) => {
    setCommand(example);
    inputRef.current?.focus();
    setShowHelp(false);
  };

  const clearHistory = () => {
    setHistory([]);
    toast.success("Terminal cleared");
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiTerminal size={20} />
            <CardTitle>AI Agent Terminal</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHelp(!showHelp)}
            >
              <FiHelpCircle size={16} />
            </Button>
            <Button size="sm" variant="outline" onClick={clearHistory}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Help Panel */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 overflow-hidden"
            >
              <h3 className="font-semibold mb-3 text-sm">Available Commands:</h3>
              <div className="space-y-2 text-sm">
                {AVAILABLE_TOOLS.map((tool) => (
                  <div key={tool.name} className="flex items-start gap-2">
                    <code className="text-blue-600 dark:text-blue-400 font-mono text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded flex-shrink-0">
                      {tool.name}
                    </code>
                    <div className="flex-1">
                      <p className="text-muted-foreground">{tool.description}</p>
                      <button
                        onClick={() => insertExample(tool.example)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                      >
                        Example: {tool.example}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Terminal Output */}
        <div
          ref={terminalRef}
          className="flex-1 bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg overflow-y-auto min-h-[300px]"
        >
          {history.length === 0 && (
            <div className="text-gray-500">
              <p>Welcome to DeployEase AI Agent Terminal! 👋</p>
              <p className="mt-2">Type a command or click "Help" to see available commands.</p>
              <p className="mt-1">Example: <code className="text-green-400">list_deployments</code></p>
            </div>
          )}

          <AnimatePresence>
            {history.map((entry, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3"
              >
                {entry.type === "command" && (
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-blue-400">$</span>
                    <span className="text-white">{entry.text}</span>
                  </div>
                )}
                {entry.type === "result" && (
                  <div className={`ml-4 ${entry.isError ? "text-red-400" : "text-green-300"}`}>
                    <pre className="whitespace-pre-wrap break-words">{entry.text}</pre>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="flex items-center gap-2 text-yellow-400">
              <FiLoader className="animate-spin" size={16} />
              <span>Executing...</span>
            </div>
          )}
        </div>

        {/* Command Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command... (e.g., list_deployments)"
              className="font-mono"
              disabled={loading}
            />
          </div>
          <Button
            onClick={handleExecute}
            disabled={loading || !command.trim()}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <FiLoader className="animate-spin" size={16} />
                Running...
              </>
            ) : (
              <>
                <FiSend size={16} />
                Execute
              </>
            )}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => insertExample("list_deployments")}
            disabled={loading}
          >
            List Deployments
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => insertExample("list_instances")}
            disabled={loading}
          >
            List Instances
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowHelp(true)}
            disabled={loading}
          >
            Show Help
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


