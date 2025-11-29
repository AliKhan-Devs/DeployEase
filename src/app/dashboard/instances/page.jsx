"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Server,
  MapPin,
  Cpu,
  CalendarDays,
  Network,
  ServerCog,
  Trash2,
  PlayCircle,
  RefreshCcw,
  HardDriveUpload,
  Cloud,
} from "lucide-react";
import Link from "next/link";

// Skeleton Loader Component
function InstancesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-white/10 p-5 rounded-xl border border-white/10 h-64"
        />
      ))}
    </div>
  );
}

export default function InstancesPage() {
  const [instances, setInstances] = useState(null);

  useEffect(() => {
    document.title = "EC2 Instances - DeployEase";

    async function fetchInstances() {
      try {
        const res = await fetch("/api/instances");
        const data = await res.json();
        setInstances(data);
      } catch (err) {
        console.error(err);
      }
    }

    fetchInstances();
  }, []);

  return (
    <section className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">
          Your EC2 Instances
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage and monitor your compute resources.
        </p>
      </motion.div>

      {/* Loading State */}
      {!instances && <InstancesSkeleton />}

      {/* Empty State */}
      {instances?.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-500 mt-8 text-center p-10 border border-dashed rounded-xl
          dark:border-gray-700 flex flex-col items-center gap-3 bg-white/5 backdrop-blur"
        >
          <Cloud size={40} className="text-blue-500" />
          <p className="text-lg font-medium">No Instances Found</p>
          <p className="text-sm text-muted-foreground">
            You haven't created any EC2 instances yet.
          </p>
        </motion.div>
      )}

      {/* Instances Grid */}
      {instances && instances.length > 0 && (
        <div className="grid grid-cols-1 gap-6 mt-6">

          {instances.map((instance, index) => (
            <motion.div
              key={instance.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="hover:shadow-xl hover:-translate-y-1 transition-all duration-200 
                rounded-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950"
              >
                <CardHeader className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Server className="text-blue-600" size={20} />
                    <h2 className="text-lg font-semibold">
                      {instance.awsInstanceId}
                    </h2>
                  </div>

                  <Badge
                    className={
                      instance.status === "Running"
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                    }
                  >
                    {instance.status || "Running"}
                  </Badge>
                </CardHeader>

                <CardContent className="text-sm space-y-5">

                  {/* Instance Info - Two Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Public IP */}
                    <div className="flex items-center gap-2">
                      <Network size={16} className="text-blue-600" />
                      <span className="font-medium">Public IP:</span>
                      {instance.publicIp || <span className="italic text-slate-500">N/A</span>}
                    </div>

                    {/* Region */}
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-blue-600" />
                      <span className="font-medium">Region:</span> {instance.region}
                    </div>

                    {/* Instance Type */}
                    <div className="flex items-center gap-2">
                      <Cpu size={16} className="text-blue-600" />
                      <span className="font-medium">Type:</span> {instance.instanceType}
                    </div>

                    {/* Created */}
                    <div className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-blue-600" />
                      <span className="font-medium">Created:</span>
                      {new Date(instance.createdAt).toLocaleString()}
                    </div>

                  </div>

                  {/* Deployments */}
                  <div className="pt-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <ServerCog size={16} className="text-blue-600" /> Associated Deployments
                    </h3>

                    {instance.deployments.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No deployments found.</p>
                    ) : (
                      <div className="space-y-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        {instance.deployments.map((deploy, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center text-xs"
                          >
                            <span className="font-medium">{deploy.repoName}</span>
                            <Badge variant="outline" className="text-xs">
                              {deploy.appType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex justify-end flex-wrap gap-2 pt-3">

                  <Link href={`/dashboard/instances/${instance.id}/shell`}>
                    <Button size="sm" className="flex items-center gap-1">
                      <PlayCircle size={14} /> Connect
                    </Button>
                  </Link>

                  <Link href={`/dashboard/instances/${instance.id}/scale`}>
                    <Button size="sm" variant="secondary" className="flex items-center gap-1">
                      <RefreshCcw size={14} /> Auto Scale
                    </Button>
                  </Link>

                  <Link href={`/dashboard/instances/${instance.id}/resize`}>
                    <Button size="sm" variant="secondary" className="flex items-center gap-1">
                      <HardDriveUpload size={14} /> Resize Volume
                    </Button>
                  </Link>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`Delete instance ${instance.awsInstanceId}?`)) return;
                      await fetch(`/api/instances/${instance.id}`, { method: "DELETE" });
                      setInstances(prev => prev.filter(i => i.id !== instance.id));
                    }}
                    className="flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Delete
                  </Button>

                </CardFooter>

              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
