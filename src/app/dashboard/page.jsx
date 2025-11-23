// app/dashboard/page.jsx
"use client";
import DeploymentCard from "./components/DeploymentCard";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const [deployments, setDeployments] = useState([]);

  useEffect(() => {
    document.title = "Dashboard - DeployEase";
    async function fetchDeployments() {
      const res = await fetch("/api/deployments");
      const data = await res.json();
      setDeployments(data);
    }
    fetchDeployments();
  }, []);

  return (
    <section className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Recent Deployments</h1>
        <p className="text-muted-foreground mt-1">
          Overview of all your deployments.
        </p>
      </motion.div>

      {deployments.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-500 mt-6 text-center py-10 border border-dashed rounded-xl dark:border-gray-700"
        >
          No deployments yet. Deploy your first app 🚀
        </motion.p>
      ) : (
        <div className="flex flex-col gap-4 mt-6">
          {deployments.map((deploy, index) => (
            <motion.div
              key={deploy.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <DeploymentCard deployment={deploy} />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
