// app/dashboard/components/DeploymentCard.jsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal, Trash2, Server, Activity, PlusSquare } from "lucide-react";

const STATUS_STYLES = {
  SUCCESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  CREATING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  INSTALLING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  RUNNING: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DEFAULT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function DeploymentCard({ deployment }) {
  const handleDeleteDeployment = async () => {
    if (!confirm(`Are you sure you want to delete ${deployment.repoName}?`)) return;
    try {
      await fetch(`/api/deployments/${deployment.id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  const badgeStyle = STATUS_STYLES[deployment.status] || STATUS_STYLES.DEFAULT;

  return (
    <motion.div
      whileHover={{ scale: 1.015 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="group rounded-xl p-[1px] bg-gradient-to-br from-white/20 to-white/5 dark:from-gray-700/20 dark:to-gray-600/10 shadow-lg hover:shadow-xl backdrop-blur border border-gray-200/60 dark:border-gray-700/50"
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 flex flex-col justify-between h-full">
        {/* Top: Deployment info */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold">{deployment.repoName}</h3>
            <p className="text-sm text-muted-foreground mt-1">Branch: {deployment.branch}</p>
            <p className="text-sm text-muted-foreground mt-1">IP: {deployment.ec2PublicIp || "Pending..."}</p>
          </div>
          <span className={`inline-block mt-2 sm:mt-0 px-3 py-1 rounded-md text-xs font-medium ${badgeStyle}`}>
            {deployment.status}
          </span>
        </div>

        {/* Bottom: Action buttons */}
        <div className="mt-5 flex flex-wrap gap-2 justify-between">
          <Link
            href={`/dashboard/deployments/${deployment.id}`}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <Server size={16} /> Details
          </Link>

          <Link
            href={`/dashboard/deployments/${deployment.id}/shell`}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-700 text-white hover:bg-gray-800 transition"
          >
            <Terminal size={16} /> Connect
          </Link>

          <Link
            href={`/dashboard/deployments/${deployment.id}/scall`}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
          >
            <Activity size={16} /> Auto Scale
          </Link>

          <Link
            href={`/dashboard/deployments/${deployment.id}/increase-volume`}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            <PlusSquare size={16} /> Increase Volume
          </Link>

          <button
            onClick={handleDeleteDeployment}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
}
