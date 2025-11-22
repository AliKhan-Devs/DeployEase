"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { io as socketClient } from "socket.io-client";

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

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === form.targetInstanceId),
    [instances, form.targetInstanceId]
  );

  const refreshData = useCallback(async () => {
    if (!session) return;
    try {
      const [instancesRes, deploymentsRes] = await Promise.all([
        fetch("/api/instances"),
        fetch("/api/deployments"),
      ]);

      if (instancesRes.ok) {
        const data = await instancesRes.json();
        setInstances(data || []);
      }
      if (deploymentsRes.ok) {
        const data = await deploymentsRes.json();
        setDeployments(data || []);
      }
    } catch (err) {
      console.error("Failed to refresh deployment data", err);
    }
  }, [session]);

  useEffect(() => {
    refreshData();
  }, [refreshData, refreshFlag]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhooks/github`);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const socket = socketClient(SOCKET_URL);

    socket.on("connect", () => {
      socket.emit("join-room", session.user.id);
    });

    socket.on("deploy-log", (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    return () => socket.disconnect();
  }, [session]);

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
    const target = instances.find((instance) => instance.id === newInstanceId);
    setForm((prev) => ({
      ...prev,
      targetInstanceId: newInstanceId,
      accessKeyId: newInstanceId ? "" : prev.accessKeyId,
      secretAccessKey: newInstanceId ? "" : prev.secretAccessKey,
      region: newInstanceId && target ? target.region : prev.region,
      instanceType: newInstanceId && target ? target.instanceType : prev.instanceType,
    }));
  };

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);
    setLogs([]);

    try {
      const body = {
        ...form,
        repoName,
        repoUrl,
        branch: "main",
        action: "deploy",
      };

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

      if (data.privateKey && data.keyPairName) {
        const blob = new Blob([data.privateKey], { type: "application/x-pem-file" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${data.keyPairName}.pem`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      }

      setDeployment(data);
      setLogs((prev) => [...prev, `✅ Deployment complete! Visit ${data.deployment?.exposedUrl || `http://${data.publicIp}`}`]);
      setRefreshFlag((prev) => prev + 1);
    } catch (err) {
      setError(err.message);
      setLogs((prev) => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEnv = async (deploymentId) => {
    const newEnv = prompt("Enter new environment variables (overwrites existing):", "");
    if (newEnv === null) return;

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

  return (
    <section className="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h2 className="text-2xl font-bold mb-2">{repoName}</h2>
        <a href={repoUrl} target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          {repoUrl}
        </a>
      </header>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="text-lg font-semibold">Deployment Configuration</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Target Instance
            <select
              name="targetInstanceId"
              value={form.targetInstanceId}
              onChange={handleInstanceSelect}
              className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
            >
              <option value="">Create new EC2 instance</option>
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.awsInstanceId} ({instance.region})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Deploy Path (optional)
            <input
              name="repoSubPath"
              placeholder="e.g. frontend or apps/api"
              value={form.repoSubPath}
              onChange={handleChange}
              className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
            />
          </label>

          {!form.targetInstanceId && (
            <>
              <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                AWS Access Key ID
                <input
                  name="accessKeyId"
                  placeholder="AWS Access Key ID"
                  value={form.accessKeyId}
                  onChange={handleChange}
                  className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
                />
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                AWS Secret Access Key
                <input
                  name="secretAccessKey"
                  type="password"
                  placeholder="AWS Secret Access Key"
                  value={form.secretAccessKey}
                  onChange={handleChange}
                  className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
                />
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                AWS Region
                <input
                  name="region"
                  placeholder="Region (default: us-east-1)"
                  value={form.region}
                  onChange={handleChange}
                  className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
                />
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Instance Type
                <input
                  name="instanceType"
                  placeholder="Instance Type (t3.micro)"
                  value={form.instanceType}
                  onChange={handleChange}
                  className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
                />
              </label>
            </>
          )}

          <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Application Port
            <input
              name="port"
              placeholder="Port (e.g. 3000)"
              value={form.port}
              onChange={handleChange}
              className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
            />
          </label>

          <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Entry Point / Command
            <input
              name="mainfile"
              placeholder="Main file or command (index.js, npm start, app.py)"
              value={form.mainfile}
              onChange={handleChange}
              className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
            />
          </label>
        </div>

        <label className="flex flex-col text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Application Type
          <select
            name="appType"
            value={form.appType}
            onChange={handleChange}
            className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700"
          >
            <option value="node">Node.js App</option>
            <option value="react">React App</option>
            <option value="python">Python App</option>
            <option value="static">Static HTML</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="autoDeploy"
            checked={form.autoDeploy}
            onChange={handleChange}
            className="h-4 w-4"
          />
          Enable auto-deploy on push
        </label>

        <textarea
          name="env"
          placeholder="Environment Variables (one per line)"
          value={form.env}
          onChange={handleChange}
          className="w-full mt-3 p-2 rounded bg-gray-100 dark:bg-gray-700 h-24"
        />

        <button
          onClick={handleDeploy}
          disabled={loading}
          className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-70"
        >
          {loading ? "Deploying..." : "Deploy Now 🚀"}
        </button>

        {deployment && deployment.publicIp && (
          <p className="text-green-600 text-sm mt-3">
            ✅ Instance ready — IP: {deployment.publicIp}
          </p>
        )}
        {deployment?.deployment?.exposedUrl && (
          <p className="text-green-600 text-sm">
            🌐 Access app at{" "}
            <a href={deployment.deployment.exposedUrl} className="underline" target="_blank">
              {deployment.deployment.exposedUrl}
            </a>
          </p>
        )}
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <div className="mt-4 bg-black dark:bg-gray-700 p-3 rounded h-60 overflow-y-auto text-xs font-mono text-white space-y-1">
          {logs.map((log, i) => (
            <p key={i}>{log}</p>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Existing Deployments</h3>
        {webhookUrl && (
          <div className="mb-4 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="font-semibold">Auto-deploy webhook</p>
            <p>
              Configure a GitHub push webhook pointing to{" "}
              <span className="font-mono">{webhookUrl}</span>. Use the secret stored in{" "}
              <span className="font-mono">GITHUB_WEBHOOK_SECRET</span>.
            </p>
          </div>
        )}
        {deployments.length === 0 ? (
          <p className="text-sm text-gray-500">No deployments yet.</p>
        ) : (
          <div className="space-y-3">
            {deployments.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col gap-2"
              >
                <div className="flex flex-wrap gap-2 justify-between">
                  <div>
                    <p className="font-semibold">{item.repoName}</p>
                    <p className="text-xs text-gray-500">Instance: {item.instance?.awsInstanceId}</p>
                  </div>
                  <div className="text-xs text-right">
                    <p>Status: {item.status}</p>
                    {item.exposedUrl && (
                      <a className="text-blue-500 underline" href={item.exposedUrl} target="_blank">
                        {item.exposedUrl}
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  <p>
                    Type: {item.appType} • Branch: {item.branch} • Auto Deploy: {item.autoDeploy ? "On" : "Off"}
                  </p>
                  {item.repoSubPath && <p>Path: /{item.repoSubPath}</p>}
                </div>
                <div className="flex gap-3 text-sm">
                  <button
                    onClick={() => handleRedeploy(item.id)}
                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Redeploy
                  </button>
                  <button
                    onClick={() => handleUpdateEnv(item.id)}
                    className="px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                  >
                    Update Env
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
