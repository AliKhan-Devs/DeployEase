"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { motion } from "framer-motion";
import Loading from "@/app/loading";

// Icons
import { SiReact, SiNodedotjs, SiPython } from "react-icons/si";
import { FiGlobe } from "react-icons/fi";

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Dashboard - DeployEase";

    async function fetchDeployments() {
      try {
        const res = await fetch("/api/deployments");
        const data = await res.json();
        setDeployments(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchDeployments();
  }, []);

  if (loading) {
    return <Loading message="Loading your deployments..." />;
  }

  if (deployments.length === 0) {
    return (
      <Alert className="mt-6">
        No deployments yet. Deploy your first app 🚀
      </Alert>
    );
  }

  // Function to get icon based on app type
  const getAppIcon = (type) => {
    switch (type.toLowerCase()) {
      case "react":
        return <SiReact size={24} className="text-blue-500 inline" />;
      case "node":
        return <SiNodedotjs size={24} className="text-green-500 inline" />;
      case "python":
        return <SiPython size={24} className="text-yellow-500 inline" />;
      case "static":
        return <FiGlobe size={24} className="text-gray-500 inline" />;
      default:
        return <FiGlobe size={24} className="text-gray-500 inline" />;
    }
  };

  return (
    <section className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Recent Deployments</h1>
        <p className="text-muted-foreground mt-1">Overview of all your deployments.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {deployments.map((deployment, index) => (
          <motion.div
            key={deployment.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="hover:shadow-lg transition">
              <CardHeader className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {getAppIcon(deployment.appType)}
                      <h3 className="text-lg font-semibold">{deployment.repoName}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Branch: {deployment.branch}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      IP: {deployment.ec2PublicIp || "Pending..."}
                    </p>
                  </div>
                </div>
                <Badge variant={deployment.status.toLowerCase()}>{deployment.status}</Badge>
              </CardHeader>

              <CardContent className="pt-2">
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(deployment.createdAt).toLocaleString()}
                </p>
                {deployment.finishedAt && (
                  <p className="text-sm text-muted-foreground">
                    Finished: {new Date(deployment.finishedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>

              <CardFooter className="flex gap-2 flex-wrap">
                <Button size="sm" asChild>
                  <a href={`/dashboard/deployments/${deployment.id}`}>Details</a>
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
