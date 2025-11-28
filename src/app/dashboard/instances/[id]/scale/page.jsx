"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { io as socketClient } from "socket.io-client";
import { Loader2 } from "lucide-react";
import Loading from "@/app/loading";

export default function AutoScalePage() {
  const params = useParams();
  const instanceId = params.id;
  const router = useRouter();

  const [minSize, setMinSize] = useState(1);
  const [maxSize, setMaxSize] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);

  const logRef = useRef();

  // Get userId to join socket room
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    async function fetchSession() {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data?.user?.id) setUserId(data.user.id);
    }
    fetchSession();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const socket = socketClient(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000"
    );

    socket.on("connect", () => {
      socket.emit("join-room", userId);
    });

    socket.on("deploy-log", (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    return () => socket.disconnect();
  }, [userId]);

  useEffect(() => {
    async function fetchDeployment() {
      setLoading(true);
      const res = await fetch(`/api/instances/${instanceId}`);
      const data = await res.json();
      setDeployment(data);
      setLoading(false);
    }
    fetchDeployment();
  }, [instanceId]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleAutoScale = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auto-scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          minSize: parseInt(minSize),
          maxSize: parseInt(maxSize),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to configure auto scaling");

      router.push(`/instances/${instanceId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading message="Loading instance details..." />;
  }

  return (
    <section className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Auto Scaling Configuration</h1>
        <p className="text-gray-500 mt-1">
          Instance ID: <span className="font-medium">{instanceId}</span>
        </p>

        {deployment && (
          <p className="text-gray-600 mt-1">
            Instance Public IP:{" "}
            <span className="font-medium">
              {deployment.ec2PublicIp || "Fetching..."}
            </span>
          </p>
        )}
      </div>

      {/* AutoScale Config Panel */}
      <div className="border rounded-lg bg-white shadow-sm p-6 space-y-6">
        <h2 className="text-lg font-semibold">Scaling Limits</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Minimum Instances</label>
            <input
              type="number"
              min={1}
              value={minSize}
              onChange={(e) => setMinSize(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Maximum Instances</label>
            <input
              type="number"
              min={1}
              value={maxSize}
              onChange={(e) => setMaxSize(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleAutoScale}
          disabled={submitting}
          className="bg-blue-600 text-white w-full py-2 rounded-md flex justify-center items-center hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" /> Configuring...
            </>
          ) : (
            "Enable Auto Scaling"
          )}
        </button>

        {error && <p className="text-red-600 font-medium">{error}</p>}
      </div>

      {/* Logs Panel */}
      <div className="border rounded-lg bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-3">Live Logs</h2>

        <div
          ref={logRef}
          className="bg-black text-green-400 p-4 rounded h-96 overflow-y-auto font-mono text-xs"
        >
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
