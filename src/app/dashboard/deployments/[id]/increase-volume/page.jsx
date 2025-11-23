"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { io as socketClient } from "socket.io-client";

export default function IncreaseVolumePage() {
  const params = useParams();
  const deploymentId = params.id;

  const [additionalGB, setAdditionalGB] = useState(1);
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const logContainerRef = useRef();

  // Get userId from session (optional if your backend uses session)
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

    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    const socket = socketClient(SOCKET_URL);

    socket.on("connect", () => {
      console.log("Socket connected for volume logs");
      // Join user's room to receive logs
      socket.emit("join-room", userId);
    });

    socket.on("deploy-log", (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleIncreaseVolume = async () => {
    setStatus("running");
    setResult(null);
    setLogs([]);

    try {
      const res = await fetch("/api/increase-volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentId, additionalGB: Number(additionalGB) }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setStatus("success");
      } else {
        setStatus("error");
        setLogs((prev) => [...prev, `❌ Error: ${data.error || "Unknown error"}`]);
      }
    } catch (err) {
      setStatus("error");
      setLogs((prev) => [...prev, `❌ Exception: ${err.message}`]);
    }
  };

  return (
    <section className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Increase Volume</h1>
      <p className="text-gray-600">Deployment ID: {deploymentId}</p>

      <div className="flex items-center gap-4 mt-4">
        <label className="text-gray-700 font-semibold">Additional GB:</label>
        <input
          type="number"
          min={1}
          value={additionalGB}
          onChange={(e) => setAdditionalGB(e.target.value)}
          className="border px-2 py-1 rounded w-24"
        />
        <button
          onClick={handleIncreaseVolume}
          disabled={status === "running"}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "running" ? "Increasing..." : "Increase Volume"}
        </button>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Logs / Status</h2>
        <div
          ref={logContainerRef}
          className="bg-black text-green-400 p-4 rounded h-96 overflow-y-auto font-mono text-xs"
        >
          {logs.length === 0 ? (
            <p className="text-gray-400">Waiting for action...</p>
          ) : (
            logs.map((log, i) => <p key={i}>{log}</p>)
          )}
        </div>
      </div>

      {result && (
        <div className="mt-4 p-4 bg-green-100 text-green-800 rounded">
          <p>Volume updated successfully!</p>
          <p>Volume ID: {result.volumeId}</p>
          <p>Previous Size: {result.previousSize} GB</p>
          <p>New Size: {result.newSize} GB</p>
        </div>
      )}
    </section>
  );
}
