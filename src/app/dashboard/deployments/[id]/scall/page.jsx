"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io as socketClient } from "socket.io-client";

export default function AutoScalePage() {
  const params = useParams();
  const deploymentId = params.id;
  const router = useRouter();

  const [minSize, setMinSize] = useState(1);
  const [maxSize, setMaxSize] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [deployment, setDeployment] = useState(null);

  // Fetch deployment info for logs & IP display
  useEffect(() => {
    async function fetchDeployment() {
      const res = await fetch(`/api/deployments/${deploymentId}`);
      const data = await res.json();
      setDeployment(data);
    }
    fetchDeployment();
  }, [deploymentId]);

  // Socket live logs
  useEffect(() => {
    if (!deployment) return;
    const socket = socketClient("http://localhost:4000");

    socket.on("connect", () => {
      console.log("Socket connected for live tail");
      socket.emit("start-live-tail", deployment); // send deployment info for SSH
    });

    socket.on("deploy-log", (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    return () => {
      socket.emit("stop-live-tail", deployment.id);
      socket.disconnect();
    };
  }, [deployment]);

  const handleAutoScale = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auto-scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deploymentId,
          minSize: parseInt(minSize),
          maxSize: parseInt(maxSize),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to configure auto scaling");

      alert(`Auto Scaling enabled! Load Balancer DNS: ${result.lbDns}`);
      router.push(`/deployments/${deploymentId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Enable Auto Scaling</h1>

      {deployment && (
        <p className="text-gray-600">
          Current Instance IP: <strong>{deployment.ec2PublicIp || "Pending..."}</strong>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium">Minimum Instances</label>
          <input
            type="number"
            min={1}
            value={minSize}
            onChange={(e) => setMinSize(e.target.value)}
            className="w-full border px-3 py-2 rounded-md"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Maximum Instances</label>
          <input
            type="number"
            min={1}
            value={maxSize}
            onChange={(e) => setMaxSize(e.target.value)}
            className="w-full border px-3 py-2 rounded-md"
          />
        </div>
      </div>

      <button
        onClick={handleAutoScale}
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Configuring..." : "Enable Auto Scaling"}
      </button>
      {error && <p className="mt-2 text-red-600">{error}</p>}

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Live Logs</h2>
        <div className="bg-black text-green-400 p-4 rounded h-96 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-400">Waiting for logs...</p>
          ) : (
            logs.map((log, i) => <p key={i}>{log}</p>)
          )}
        </div>
      </div>
    </section>
  );
}
