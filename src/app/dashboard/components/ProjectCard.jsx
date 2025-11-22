"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { io as socketClient } from "socket.io-client";

export default function ProjectCard({ repo}) {
  const {data: session} = useSession();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-1",
    instanceType: "t3.micro",
    port: "3000",
    mainfile: "index.js",
    env: "",
  });
  const [deployment, setDeployment] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!session) return;

    const socket = socketClient("http://localhost:4000");

    socket.on("connect", () => {
      socket.emit("join-room", session.user.id);
    });

    socket.on("deploy-log", (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    return () => socket.disconnect();
  }, [session]);


  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);
    setLogs([]); // clear previous logs
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          repoName: repo.name,
          repoUrl: repo.html_url,
          branch: "main",
        }),
      });

      if (!res.ok) throw new Error("Failed to deploy");

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Auto download PEM file
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

      // Update deployment info
      setDeployment(data);
      setLogs((prev) => [...prev, `✅ Deployment finished! App live at http://${data.publicIp}`]);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLogs((prev) => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-bold">{repo.name}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
        {repo.description || "No description provided"}
      </p>

      <div className="mt-3 flex justify-between text-sm text-gray-500">
        <span>⭐ {repo.stargazers_count}</span>
        <a
          href={repo.html_url}
          target="_blank"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          View Repo →
        </a>
      </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
      >
        {showForm ? "Cancel" : "Deploy to AWS"}
      </button>

      {showForm && (
        <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
          <input
            name="accessKeyId"
            type="text"
            placeholder="AWS Access Key ID"
            value={form.accessKeyId}
            onChange={handleChange}
            className="w-full mb-2 p-2 rounded bg-gray-100 dark:bg-gray-700"
          />
          <input
            name="secretAccessKey"
            type="password"
            placeholder="AWS Secret Access Key"
            value={form.secretAccessKey}
            onChange={handleChange}
            className="w-full mb-2 p-2 rounded bg-gray-100 dark:bg-gray-700"
          />
          <input
            name="region"
            type="text"
            placeholder="AWS Region (default: us-east-1)"
            value={form.region}
            onChange={handleChange}
            className="w-full mb-2 p-2 rounded bg-gray-100 dark:bg-gray-700"
          />
          <input
            name="instanceType"
            type="text"
            placeholder="Instance Type (default: t2.micro)"
            value={form.instanceType}
            onChange={handleChange}
            className="w-full mb-2 p-2 rounded bg-gray-100 dark:bg-gray-700"
          />
          <input
            name="port"
            type="text"
            placeholder="e.g 3000"
            value={form.port}
            onChange={handleChange}
            className="w-full mb-2 p-2 rounded bg-gray-100 dark:bg-gray-700"
          />
          <input
            name="mainfile"
            type="text"
            placeholder="e.g index.js"
            value={form.mainfile}
            onChange={handleChange}
            className="w-full mb-2 p-2 rounded bg-gray-100 dark:bg-gray-700"
          />
          <textarea
            name="env"
            placeholder={`PORT=4000\nMONGO_URI=mongodb+srv://...`}
            onChange={(e) => setForm({ ...form, env: e.target.value })}
            className="w-full mb-2 p-2 rounded bg-gray-100 dark:bg-gray-700"
          />

          <button
            onClick={handleDeploy}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-70"
          >
            {loading ? "Deploying..." : "Deploy Now 🚀"}
          </button>

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {deployment && (
            <p className="text-green-600 text-sm mt-2">
              ✅ Instance Created — IP: {deployment.publicIp}
            </p>
          )}

          <div className="mt-3 bg-gray-100 dark:bg-gray-700 p-2 rounded h-40 overflow-y-auto text-xs font-mono">
            {logs.map((log, i) => (
              <p key={i}>{log}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
