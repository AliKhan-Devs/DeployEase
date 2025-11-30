"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import Loading from "../loading";

// Icons
import { FiServer, FiBarChart2, FiCpu, FiCheckCircle, FiXCircle, FiClock } from "react-icons/fi";
import { SiNodedotjs, SiPython, SiReact } from "react-icons/si";
import { FiGlobe } from "react-icons/fi";
import Link from "next/link";


// Map app type → icon
const getAppIcon = (type) => {
  switch (type?.toLowerCase()) {
    case "react":
      return <SiReact size={22} className="text-blue-500" />;
    case "node":
      return <SiNodedotjs size={22} className="text-green-600" />;
    case "python":
      return <SiPython size={22} className="text-yellow-500" />;
    case "static":
      return <FiGlobe size={20} className="text-gray-500" />;
    default:
      return <FiGlobe size={20} className="text-gray-500" />;
  }
};

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Dashboard - DeployEase";

    async function fetchData() {
      try {
        const res = await fetch("/api/analytics");
        const data = await res.json();

        if (!data.success) {
          throw new Error("Failed to load analytics");
        }

        setAnalytics(data.analytics);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Loading state
  if (loading) {
    return <Loading message="Loading dashboard analytics..." />;
  }

  // Error UI
  if (!analytics) {
    return (
      <Alert className="mt-6">
        Something went wrong loading your analytics ⚠️  
        Please refresh the page.
      </Alert>
    );
  }

  const { deployments, ec2 } = analytics;

  return (
    <section className="p-6 space-y-10">
      {/* Top Welcome Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your deployments and EC2 instances.
        </p>
      </motion.div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Total Deployments */}
        <AnalyticsCard
          title="Total Deployments"
          value={deployments.total}
          icon={<FiBarChart2 size={26} />}
        />

        {/* Success */}
        <AnalyticsCard
          title="Successful"
          value={deployments.success}
          icon={<FiCheckCircle size={26} className="text-green-600" />}
        />

        {/* Failed */}
        <AnalyticsCard
          title="Failed"
          value={deployments.failed}
          icon={<FiXCircle size={26} className="text-red-500" />}
        />

        {/* Running */}
        <AnalyticsCard
          title="Running"
          value={deployments.running}
          icon={<FiClock size={26} className="text-yellow-500" />}
        />
      </div>

      {/* EC2 Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnalyticsCard
          title="Total EC2 Instances"
          value={ec2.total}
          icon={<FiServer size={26} />}
        />

        <AnalyticsCard
          title="Active EC2 Instances"
          value={ec2.active}
          icon={<FiCpu size={26} className="text-blue-600" />}
        />
      </div>

      {/* AI Assistant Quick Access */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  {/* <FiBot size={32} className="text-blue-600 dark:text-blue-400" /> */}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Need Help? Ask Our AI Assistant!</h3>
                  <p className="text-muted-foreground">
                    Don't understand something? Our AI assistant can help you deploy, manage, and scale your applications through simple conversation.
                  </p>
                </div>
              </div>
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/dashboard/mcp">
                  {/* <FiBot className="mr-2" /> */}
                  Open AI Assistant
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Deployments */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold mt-8 mb-4">Recent Deployments</h2>

        {deployments.recentDeployments.length === 0 ? (
          <Alert>No recent deployments found.</Alert>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {deployments.recentDeployments.map((dep, index) => (
              <motion.div
                key={dep.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="hover:shadow-lg transition">
                  <CardHeader className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {getAppIcon(dep.appType)}
                      <h3 className="font-semibold text-lg">{dep.repoName}</h3>
                    </div>
                    <Badge>{dep.status}</Badge>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(dep.createdAt).toLocaleString()}
                    </p>
                    {dep.finishedAt && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Finished: {new Date(dep.finishedAt).toLocaleString()}
                      </p>
                    )}

                    <Button size="sm" asChild className="mt-4">
                      <a href={`/dashboard/deployments/${dep.id}`}>View Details</a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>


    </section>
  );
}

/* ----------------------------
   Reusable Analytics Card
----------------------------- */

function AnalyticsCard({ title, value, icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="p-5 hover:shadow-xl transition rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            <h3 className="text-3xl font-bold mt-1">{value}</h3>
          </div>
          <div className="p-3 rounded-lg bg-gray-100 text-gray-900">
            {icon}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
