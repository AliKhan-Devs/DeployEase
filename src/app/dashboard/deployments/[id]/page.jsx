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



  if (loading) return <p className="p-6 text-gray-500">Loading deployment...</p>;
  if (!deployment) return <p className="p-6 text-red-500">Deployment not found.</p>;

  return (
    <section className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{deployment.repoName} - Deployment</h1>
      <p className="text-gray-600">Branch: {deployment.branch}</p>
      <p className="text-gray-600">Status: {deployment.status}</p>
      <p className="text-gray-600">IP: {deployment.ec2PublicIp || "Pending..."}</p>

      
    </section>
  );
}
