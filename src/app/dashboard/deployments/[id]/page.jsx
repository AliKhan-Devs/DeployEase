"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { GitBranch, Server, Key, Link as LinkIcon, Play, Calendar, FileText, Database } from "lucide-react";
import Loading from "@/app/loading";

export default function DeploymentDetailsPage() {
  const params = useParams();
  const deploymentId = params.id;

  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeployment() {
      try {
        const res = await fetch(`/api/deployments/${deploymentId}`);
        const data = await res.json();
        setDeployment(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchDeployment();
  }, [deploymentId]);

  if (loading) return <Loading message="Loading deployment details..." />;
  if (!deployment) return <Alert variant="destructive">Deployment not found.</Alert>;

  return (
    <section className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex justify-between items-center gap-3">
          <h1 className="text-2xl font-bold">{deployment.repoName}</h1>
          <Badge variant={deployment.status.toLowerCase()}>{deployment.status}</Badge>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* General Info */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar size={18}/> General Info</h2>
            <p><strong>Project ID:</strong> {deployment.projectId || "N/A"}</p>
            <p><strong>User ID:</strong> {deployment.userId || "N/A"}</p>
            <p><strong>Created:</strong> {new Date(deployment.createdAt).toLocaleString()}</p>
            {deployment.updatedAt && <p><strong>Updated:</strong> {new Date(deployment.updatedAt).toLocaleString()}</p>}
          </div>

          {/* Repository Info */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2"><GitBranch size={18}/> Repository</h2>
            <p><strong>Repo URL:</strong> <a className="text-blue-600 underline flex items-center gap-1" href={deployment.repoUrl} target="_blank"><LinkIcon size={14}/>{deployment.repoUrl}</a></p>
            <p><strong>Branch:</strong> {deployment.branch}</p>
            <p><strong>Slug:</strong> {deployment.slug || "N/A"}</p>
            <p><strong>Repo Sub Path:</strong> {deployment.repoSubPath || "N/A"}</p>
            <p><strong>Repo Path:</strong> {deployment.repoPath || "N/A"}</p>
            <p><strong>Entry Point:</strong> {deployment.entryPoint || "N/A"}</p>
          </div>

          {/* Instance Info */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Server size={18}/> Instance</h2>
            <p><strong>EC2 Instance ID:</strong> {deployment.ec2InstanceId || "N/A"}</p>
            <p><strong>Public IP:</strong> {deployment.ec2PublicIp || "Pending..."}</p>
            <p><strong>Key Pair:</strong> <Key size={14}/> {deployment.keyPairName || "N/A"}</p>
          </div>

          {/* Deployment Info */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Play size={18}/> Deployment Info</h2>
            <p><strong>App Type:</strong> {deployment.appType}</p>
            <p><strong>App Directory:</strong> {deployment.appDirectory || "N/A"}</p>
            <p><strong>App Port:</strong> {deployment.appPort || "N/A"}</p>
            <p><strong>Exposed URL:</strong> {deployment.exposedUrl || "N/A"}</p>
            <p><strong>Auto Deploy:</strong> {deployment.autoDeploy ? "Yes" : "No"}</p>
            <p><strong>Status:</strong> {deployment.status}</p>
            <p><strong>Started At:</strong> {new Date(deployment.startedAt).toLocaleString()}</p>
            {deployment.finishedAt && <p><strong>Finished At:</strong> {new Date(deployment.finishedAt).toLocaleString()}</p>}
          </div>

          {/* Environment Variables */}
          {deployment.envVars && (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold flex items-center gap-2"><FileText size={18}/> Environment Variables</h2>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">{deployment.envVars}</pre>
            </div>
          )}

          {/* Logs */}
          {deployment.logs && (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Database size={18}/> Logs</h2>
              <pre className="bg-black text-white p-2 rounded overflow-x-auto whitespace-pre-wrap">{deployment.logs}</pre>
            </div>
          )}

        </CardContent>

        <CardFooter className="flex justify-between flex-wrap gap-2">
          <Button size="sm" asChild>
            <a href="/dashboard/deployments">Back to Deployments</a>
          </Button>
          <Button size="sm" variant="secondary" disabled>Update Env</Button>
          <Button size="sm" variant="secondary" disabled>Redeploy</Button>
        </CardFooter>
      </Card>
    </section>
  );
}
