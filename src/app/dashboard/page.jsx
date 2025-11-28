"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Server, MapPin, Cpu, CalendarDays, Network, ServerCog, Trash2, PlayCircle, RefreshCcw, HardDriveUpload } from "lucide-react";
import Link from "next/link";

export default function InstancesPage() {
  const [instances, setInstances] = useState([]);

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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Your EC2 Instances</h1>
        <p className="text-muted-foreground mt-1">
          Overview of all your EC2 Instances.
        </p>
      </motion.div>

      {instances.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-500 mt-6 text-center py-10 border border-dashed rounded-xl dark:border-gray-700 flex flex-col items-center gap-2"
        >
          No Instances found in your account
          <Server size={24} />
        </motion.p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {instances.map((instance, index) => (
            <motion.div
              key={instance.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="flex justify-between items-center gap-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Server className="text-blue-600" size={18} />
                    {instance.awsInstanceId}
                  </h2>
                  <Badge variant="success">{instance.status || "Running"}</Badge>
                </CardHeader>

                <CardContent className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Network size={16} className="text-blue-600" /> 
                    <span className="font-medium">Public IP:</span> {instance.publicIp || "N/A"}
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-600" /> 
                    <span className="font-medium">Region:</span> {instance.region}
                  </div>

                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-blue-600" /> 
                    <span className="font-medium">Instance Type:</span> {instance.instanceType}
                  </div>

                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-blue-600" /> 
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(instance.createdAt).toLocaleDateString()}
                  </div>

                  {/* Deployments */}
                  <div className="mt-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
                      <ServerCog size={16} className="text-blue-600" /> Associated Deployments
                    </h3>
                    {instance.deployments.length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400 text-xs italic">
                        No deployments yet.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {instance.deployments.map((deploy, indx) => (
                          <li key={indx} className="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1 px-2">
                            <span>
                              <span className="font-semibold">{indx + 1}.</span> {deploy.repoName}
                            </span>
                            <Badge variant="secondary" className="text-xs">{deploy.appType}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-wrap gap-2">
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
                      <HardDriveUpload size={14} /> Increase Volume
                    </Button>
                  </Link>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex items-center gap-1"
                    onClick={async () => {
                      if (!confirm(`Delete instance ${instance.awsInstanceId}?`)) return;
                      try {
                        await fetch(`/api/instances/${instance.id}`, { method: "DELETE" });
                        setInstances(prev => prev.filter(i => i.id !== instance.id));
                      } catch (err) { console.error(err); }
                    }}
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
