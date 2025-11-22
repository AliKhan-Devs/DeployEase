"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { io as socketClient } from "socket.io-client";

export default function DeploymentDetailsPage() {
  const params = useParams();
  const deploymentId = params.id;

  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeployment() {
      const res = await fetch(`/api/deployments/${deploymentId}`);
      const data = await res.json();
      setDeployment(data);
      setLoading(false);
    }
    fetchDeployment();
  }, [deploymentId]);

  useEffect(() => {
    if (!deployment) return;
    const socket = socketClient("http://localhost:4000");

    socket.on("connect", () => {
      console.log("Socket connected for live tail");
      socket.emit("start-live-tail", deployment); // send deployment info for SSH
    });

    socket.on("live-log", (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    return () => {
      socket.emit("stop-live-tail", deployment.id);
      socket.disconnect();
    };
  }, [deployment]);

  if (loading) return <p className="p-6 text-gray-500">Loading deployment...</p>;
  if (!deployment) return <p className="p-6 text-red-500">Deployment not found.</p>;

  return (
    <section className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{deployment.repoName} - Deployment</h1>
      <p className="text-gray-600">Branch: {deployment.branch}</p>
      <p className="text-gray-600">Status: {deployment.status}</p>
      <p className="text-gray-600">IP: {deployment.ec2PublicIp || "Pending..."}</p>

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
