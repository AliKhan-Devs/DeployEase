"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { io as socketClient } from "socket.io-client";
import { Cloud, RefreshCw, Zap, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import Loading from "@/app/loading";
import toast from "react-hot-toast";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

const defaultForm = {
  accessKeyId: "",
  secretAccessKey: "",
  region: "us-east-1",
  instanceType: "t3.micro",
  port: "3000",
  mainfile: "index.js",
  env: "",
  appType: "node",
  repoSubPath: "",
  autoDeploy: false,
  targetInstanceId: "",
};

const defaultMainfiles = {
  node: { mainfile: "index.js", port: "3000" },
  react: { mainfile: "npm start", port: "80" },
  python: { mainfile: "app.py", port: "8000" },
  static: { mainfile: "", port: "80" },
};

export default function RepoDeployPage() {
  const { data: session } = useSession();
  const params = useSearchParams();

  const repoName = params.get("name");
  const repoUrl = params.get("url");

  const [form, setForm] = useState(defaultForm);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deployment, setDeployment] = useState(null);
  const [error, setError] = useState(null);
  const [instances, setInstances] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const logsRef = useRef(null);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === form.targetInstanceId),
    [instances, form.targetInstanceId]
  );

  const refreshData = useCallback(async () => {

    if (!session) return;

    try {
      setGlobalLoading(true);
      const [instancesRes, deploymentsRes] = await Promise.all([
        fetch("/api/instances"),
        fetch("/api/deployments"),
      ]);
      if (instancesRes.ok) setInstances(await instancesRes.json());
      if (deploymentsRes.ok) setDeployments(await deploymentsRes.json());
    } catch (err) {
      console.error("Failed to refresh deployment data", err);
    }
    finally {
      setGlobalLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refreshData();
  }, [refreshData, refreshFlag]);

  useEffect(() => {
    if (typeof window !== "undefined")
      setWebhookUrl(`${window.location.origin}/api/webhooks/github`);
  }, []);

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

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const newValue = type === "checkbox" ? checked : value;
    setForm((prev) => {
      let next = { ...prev, [name]: newValue };
      if (name === "appType") {
        const defaults = defaultMainfiles[newValue] ?? defaultMainfiles.node;
        next = { ...next, ...defaults, appType: newValue };
      }
      return next;
    });
  };

  const handleInstanceSelect = (event) => {
    const newInstanceId = event.target.value;
    const target = instances.find((i) => i.id === newInstanceId);
    setForm((prev) => ({
      ...prev,
      targetInstanceId: newInstanceId,
      accessKeyId: newInstanceId ? "" : prev.accessKeyId,
      secretAccessKey: newInstanceId ? "" : prev.secretAccessKey,
      region: newInstanceId && target ? target.region : prev.region,
      instanceType: newInstanceId && target ? target.instanceType : prev.instanceType,
    }));
  };

  // const handleDeploy = async () => {
  //   setLoading(true);
  //   setError(null);
  //   setLogs([]);
  //   try {
  //     const body = { ...form, repoName, repoUrl, branch: "main", action: "deploy" };
  //     if (selectedInstance) {
  //       body.region = selectedInstance.region;
  //       body.instanceType = selectedInstance.instanceType;
  //     }
  //     const res = await fetch("/api/deploy", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(body),
  //     });
  //     if (!res.ok) throw new Error("Deployment failed");
  //     const data = await res.json();
  //     if (data.error) throw new Error(data.error);

  //     if (data.privateKey && data.keyPairName) {
  //       const blob = new Blob([data.privateKey], { type: "application/x-pem-file" });
  //       const a = document.createElement("a");
  //       a.href = URL.createObjectURL(blob);
  //       a.download = `${data.keyPairName}.pem`;
  //       document.body.appendChild(a);
  //       a.click();
  //       a.remove();
  //       URL.revokeObjectURL(a.href);
  //     }

  //     setDeployment(data);
  //     setLogs((prev) => [
  //       ...prev,
  //       `✅ Deployment complete! Visit ${data.deployment?.exposedUrl || `http://${data.publicIp}`}`,
  //     ]);
  //     setRefreshFlag((prev) => prev + 1);
  //   } catch (err) {
  //     setError(err.message);
  //     setLogs((prev) => [...prev, `❌ Error: ${err.message}`]);
  //   } finally {
  //     setLoading(false);
  //   }
  // };



  const handleDeploy = async () => {
  setLoading(true);
  setError(null);
  setLogs([]);

  try {
    const body = { ...form, repoName, repoUrl, branch: "main", action: "deploy" };
    if (selectedInstance) {
      body.region = selectedInstance.region;
      body.instanceType = selectedInstance.instanceType;
    }

    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Deployment failed");
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // 🎯 Immediate toast notification
    toast.success(`🚀 Deployment queued! Job ID: ${data.deploymentId}`, {
      icon: '🟢',
    });

    setDeployment(data);
    setRefreshFlag((prev) => prev + 1);

  } catch (err) {
    setError(err.message);
    toast.error(`❌ Deployment failed: ${err.message}`, { icon: '⚠️' });
    setLogs((prev) => [...prev, `❌ Error: ${err.message}`]);
  } finally {
    setLoading(false);
  }
};

  const handleUpdateEnv = async (deploymentId) => {
    const newEnv = prompt("Enter new environment variables (overwrites existing):", "");
    if (!newEnv) return;
    setLogs((prev) => [...prev, "🔄 Updating environment variables..."]);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-env", deploymentId, env: newEnv }),
      });
      if (!res.ok) throw new Error("Failed to update environment variables");
      setLogs((prev) => [...prev, "✅ Environment updated."]);
      setRefreshFlag((prev) => prev + 1);
    } catch (err) {
      setLogs((prev) => [...prev, `❌ Env update failed: ${err.message}`]);
    }
  };

  const handleRedeploy = async (deploymentId) => {
    setLogs((prev) => [...prev, "🔁 Triggering redeploy..."]);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeploy", deploymentId }),
      });
      if (!res.ok) throw new Error("Redeploy failed");
      setLogs((prev) => [...prev, "✅ Redeploy started. Watch logs for progress."]);
      setRefreshFlag((prev) => prev + 1);
    } catch (err) {
      setLogs((prev) => [...prev, `❌ Redeploy failed: ${err.message}`]);
    }
  };

  {globalLoading && <Loading message={"Loading Details...."} />}

  return (
    <section className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold">{repoName}</h2>
        <a href={repoUrl} target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          {repoUrl}
        </a>
      </header>

      {/* Deployment Configuration Card */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Deployment Configuration</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Target Instance</label>
              <select
                name="targetInstanceId"
                value={form.targetInstanceId}
                onChange={handleInstanceSelect}
                className="p-2 rounded bg-gray-100 dark:bg-gray-700"
              >
                <option value="">Create new EC2 instance</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.awsInstanceId} ({instance.region})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Deploy Path (optional)</label>
              <Input
                name="repoSubPath"
                placeholder="e.g. frontend or apps/api"
                value={form.repoSubPath}
                onChange={handleChange}
              />
            </div>

            {!form.targetInstanceId && (
              <>
                <Input
                  name="accessKeyId"
                  placeholder="AWS Access Key ID"
                  value={form.accessKeyId}
                  onChange={handleChange}
                />
                <Input
                  type="password"
                  name="secretAccessKey"
                  placeholder="AWS Secret Access Key"
                  value={form.secretAccessKey}
                  onChange={handleChange}
                />
                <Input
                  name="region"
                  placeholder="AWS Region (default: us-east-1)"
                  value={form.region}
                  onChange={handleChange}
                />
                <Input
                  name="instanceType"
                  placeholder="Instance Type (t3.micro)"
                  value={form.instanceType}
                  onChange={handleChange}
                />
              </>
            )}

            <Input
              name="port"
              placeholder="Port (e.g. 3000)"
              value={form.port}
              onChange={handleChange}
            />
            <Input
              name="mainfile"
              placeholder="Main file / Command"
              value={form.mainfile}
              onChange={handleChange}
            />
            <select name="appType" value={form.appType} onChange={handleChange} className="p-2 rounded bg-gray-100 dark:bg-gray-700">
              <option value="node">Node.js</option>
              <option value="react">React</option>
              <option value="python">Python</option>
              <option value="static">Static HTML</option>
            </select>

            <label className="flex items-center gap-2 text-sm col-span-2">
              <input type="checkbox" name="autoDeploy" checked={form.autoDeploy} onChange={handleChange} className="h-4 w-4" />
              Enable auto-deploy on push
            </label>

            <Textarea
              name="env"
              placeholder="Environment Variables (one per line)"
              value={form.env}
              onChange={handleChange}
              className="sm:col-span-2 h-24"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleDeploy} disabled={loading} className="w-full flex items-center justify-center gap-2">
            <Cloud size={16} /> {loading ? "Deploying..." : "Deploy Now"}
          </Button>
          {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        </CardFooter>
      </Card>

      {/* Deployment Logs */}
      <Accordion type="single" collapsible>
        <AccordionItem value="logs">
          <AccordionTrigger>Deployment Logs</AccordionTrigger>
          <AccordionContent>
            <div ref={logsRef} className="h-60 overflow-y-auto text-xs font-mono space-y-1 bg-black text-white p-2 rounded">
              {logs.map((log, i) => (<p key={i}>{log}</p>))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Existing Deployments */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Existing Deployments</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {webhookUrl && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="font-semibold">Auto-deploy webhook</p>
              <p>Configure GitHub webhook to <span className="font-mono">{webhookUrl}</span></p>
            </div>
          )}
          {deployments.length === 0 ? (
            <p className="text-sm text-gray-500">No deployments yet.</p>
          ) : (
            deployments.map((item) => (
              <Card key={item.id} className="p-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="space-y-1">
                    <p className="font-semibold">{item.repoName}</p>
                    <p className="text-xs text-gray-500">Instance: {item.instance?.awsInstanceId}</p>
                    <p className="text-xs text-gray-500">Type: {item.appType} • Branch: {item.branch} • Auto Deploy: {item.autoDeploy ? "On" : "Off"}</p>
                    {item.repoSubPath && <p className="text-xs text-gray-500">Path: /{item.repoSubPath}</p>}
                    {item.exposedUrl && <a href={item.exposedUrl} target="_blank" className="text-blue-500 underline text-xs">{item.exposedUrl}</a>}
                  </div>
                  <div className="flex gap-2 flex-wrap mt-2 sm:mt-0">
                    <Button onClick={() => handleRedeploy(item.id)} size="sm" className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700">
                      <RefreshCw size={14} /> Redeploy
                    </Button>
                    <Button onClick={() => handleUpdateEnv(item.id)} size="sm" className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600">
                      <Zap size={14} /> Update Env
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
