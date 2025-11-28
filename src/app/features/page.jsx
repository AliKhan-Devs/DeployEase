"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  FaGithub,
  FaServer,
  FaTerminal,
  FaCloudUploadAlt,
  FaCode,
  FaCogs,
  FaFolderOpen,
  FaNetworkWired,
  FaExpand,
  FaLayerGroup,
  FaRocket,
} from "react-icons/fa";

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-20">
      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 text-center">
        <Badge className="mb-4 text-sm">Platform Features</Badge>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
          Everything You Need For <span className="text-blue-600">AWS Deployments</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          DeployEase automates EC2 provisioning, NGINX configuration, application deployments,
          environment management, live logs, SSH, autoscaling, and much more.
        </p>
      </section>

      {/* Feature Grid */}
      <section className="max-w-6xl mx-auto px-6 mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* 1 - GitHub Auth */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaGithub className="text-3xl text-gray-700 dark:text-gray-300" />
            <CardTitle>GitHub Sign-in</CardTitle>
            <CardDescription>
              Secure OAuth login with GitHub. No passwords needed.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 2 - Dashboard */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaLayerGroup className="text-3xl text-blue-600" />
            <CardTitle>Clean Deployment Dashboard</CardTitle>
            <CardDescription>
              View all apps, their state, logs, and actions in a single view.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 3 - Deployment Actions */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaServer className="text-3xl text-green-500" />
            <CardTitle>Manage Deployments</CardTitle>
            <CardDescription>
              Live logs, delete, restart, and full EC2 app management in one place.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 4 - Browser SSH */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaTerminal className="text-3xl text-yellow-500" />
            <CardTitle>Browser-Based SSH</CardTitle>
            <CardDescription>
              Connect directly to your EC2 terminal. Run Linux commands instantly.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 5 - Repos Page */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaFolderOpen className="text-3xl text-pink-500" />
            <CardTitle>Your Repositories</CardTitle>
            <CardDescription>
              View GitHub repos & deploy any project with one click.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 6 - Deployment Wizard */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaCode className="text-3xl text-purple-500" />
            <CardTitle>Smart Deployment Wizard</CardTitle>
            <CardDescription>
              Choose app type, set region, env, port, and main file—DeployEase handles the rest.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 7 - DevOps Automation */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaCloudUploadAlt className="text-3xl text-indigo-500" />
            <CardTitle>Automated DevOps Setup</CardTitle>
            <CardDescription>
              EC2 creation, dependency installation, and NGINX configuration—automated.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 8 - Multi-app EC2 */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaNetworkWired className="text-3xl text-red-500" />
            <CardTitle>Deploy Multiple Apps on One EC2</CardTitle>
            <CardDescription>
              Add multiple apps to a single EC2 with automatic NGINX routing.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 9 - Update Env */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaCogs className="text-3xl text-green-600" />
            <CardTitle>Update Environment Variables</CardTitle>
            <CardDescription>
              Regenerate `.env` and auto-reload your service anytime.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 10 - Public URLs */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaRocket className="text-3xl text-blue-500" />
            <CardTitle>Instant Public URLs</CardTitle>
            <CardDescription>
              Access your deployed app via public IP + slug immediately.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 11 - Volume Expansion */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaExpand className="text-3xl text-orange-500" />
            <CardTitle>Expand EC2 Storage</CardTitle>
            <CardDescription>
              Increase EBS volume with one click. No console required.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 12 - Autoscaling */}
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <FaLayerGroup className="text-3xl text-teal-500" />
            <CardTitle>Autoscaling & Load Balancer</CardTitle>
            <CardDescription>
              DeployEase auto-creates ASG, ALB, health checks & scaling rules.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 mt-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Ready to deploy your next project?
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Start deploying in minutes with zero AWS console headaches.
        </p>

        <Button className="mt-6 px-6 py-3 text-lg">
          Get Started — It's Free
        </Button>
      </section>
    </main>
  );
}
