"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { io as socketClient } from "socket.io-client";
import { Loader2 } from "lucide-react";

export default function IncreaseVolumePage() {
  const params = useParams();
  const instanceId = params.id;

  const [additionalGB, setAdditionalGB] = useState(1);
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
 
  const logRef = useRef();

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
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleIncrease = async () => {
    setStatus("running");
    setLogs([]);
    setResult(null);

    try {
      const res = await fetch("/api/increase-volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, additionalGB: Number(additionalGB) }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        setStatus("success");
      } else {
        setStatus("error");
        setLogs((prev) => [...prev, "❌ Error: " + data.error]);
      }
    } catch (err) {
      setStatus("error");
      setLogs((prev) => [...prev, "❌ " + err.message]);
    }
  };

  return (
    <section className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Increase Volume</h1>
        <p className="text-gray-500 mt-1">Instance ID: {instanceId}</p>
      </div>

      {/* Volume Input Box */}
      <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
        <h2 classhellName="text-lg font-semibold">Volume Settings</h2>

        <div className="flex items-center gap-4">
          <input
            type="number"
            min={1}
            value={additionalGB}
            onChange={(e) => setAdditionalGB(e.target.value)}
            className="border rounded px-3 py-2 w-32 focus:ring-2 focus:ring-blue-500 outline-none"
          />

          <button
            onClick={handleIncrease}
            disabled={status === "running"}
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {status === "running" ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Increasing...
              </>
            ) : (
              "Increase Volume"
            )}
          </button>
        </div>
      </div>

      {/* Logs Panel */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Logs / Status</h2>

        <div
          ref={logRef}
          className="bg-black text-green-400 font-mono text-xs p-4 rounded h-96 overflow-y-auto"
        >
          {logs.length === 0 ? (
            <p className="text-gray-400">Waiting for action...</p>
          ) : (
            logs.map((log, i) => <p key={i}>{log}</p>)
          )}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="border border-green-400 bg-green-100 text-green-900 rounded-lg p-4 space-y-1 shadow-sm">
          <p className="font-semibold">Volume updated successfully!</p>
          <p>Volume ID: {result.volumeId}</p>
          <p>Previous Size: {result.previousSize} GB</p>
          <p>New Size: {result.newSize} GB</p>
        </div>
      )}
    </section>
  );
}
