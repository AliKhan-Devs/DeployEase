// app/dashboard/page.jsx
"use client";
import DeploymentCard from "./components/DeploymentCard";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [deployments, setDeployments] = useState([]);
  // Fetch all deployments from Prisma
  useEffect(() => {
    document.title = "Dashboard - DeployEase";
    // fetch deployements from api/deployments
    async function fetchDeployments() {
      const res = await fetch("/api/deployments");
      const data = await res.json();
      console.log("Fetched deployments:", data);
      setDeployments(data);
    }
    fetchDeployments();
  }, []);

  return (
    <section className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-gray-600">Overview of all your deployments.</p>

      {deployments.length === 0 ? (
        <p className="text-gray-500 mt-6">No deployments yet.</p>
      ) : (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {deployments.map((deploy) => (
            <DeploymentCard key={deploy.id} deployment={deploy} />
          ))}
        </div>
      )}
    </section>
  );
}
