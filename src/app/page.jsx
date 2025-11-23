"use client";

import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { MdTerminal } from "react-icons/md";
import { FaServer, FaRocket, FaUsers } from "react-icons/fa";

export default function ModernHomePage() {
  const { data: session } = useSession();

  return (
    <main className="relative bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        <img
          src="/images/abstract-bg.svg"
          alt="Background decoration"
          className="w-full h-full object-cover opacity-20 dark:opacity-10"
        />
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20 flex flex-col-reverse lg:flex-row items-center gap-12">
        {/* Left: Text + CTA */}
        <div className="lg:w-1/2 flex flex-col gap-6">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
            <span className="text-blue-600">Deploy</span>Ease - Effortless App Deployments on AWS
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg md:text-xl">
            Deploy, monitor, and manage your applications with real-time logs, automatic rollback, and live tail. Simplify your workflow and impress your clients.
          </p>

          <div className="flex gap-4 mt-6">
            {session ? (
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Go to Dashboard
              </Link>
            ) : (
              <button
                onClick={() => signIn("github")}
                className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-900 transition"
              >
                Sign in with GitHub
              </button>
            )}
          </div>

          {/* Feature icons row */}
          <div className="flex gap-6 mt-10">
            <div className="flex items-center gap-2">
              <MdTerminal size={28} className="text-blue-600" />
              <span className="text-gray-700 dark:text-gray-300">Live Logs</span>
            </div>
            <div className="flex items-center gap-2">
              <FaServer size={28} className="text-green-500" />
              <span className="text-gray-700 dark:text-gray-300">SSH Access</span>
            </div>
            <div className="flex items-center gap-2">
              <FaRocket size={28} className="text-yellow-500" />
              <span className="text-gray-700 dark:text-gray-300">Fast Deploy</span>
            </div>
            <div className="flex items-center gap-2">
              <FaUsers size={28} className="text-pink-500" />
              <span className="text-gray-700 dark:text-gray-300">Team Friendly</span>
            </div>
          </div>
        </div>

        {/* Right: Illustration / Graphs / Avatars */}
        <div className="lg:w-1/2 relative flex justify-center">
          {/* Placeholder for a hero image or dashboard illustration */}
          <img
            src="/dashboard.png"
            alt="Dashboard illustration"
            className="rounded-xl shadow-xl w-full max-w-lg"
          />

          {/* Optional: floating avatars */}
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 flex -space-x-3">
            <img
              src="https://testingbot.com/free-online-tools/random-avatar/300?img=1"
              alt="User"
              className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-900"
            />
            <img
              src="https://testingbot.com/free-online-tools/random-avatar/300?img=10"
              alt="User"
              className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-900"
            />
            <img
              src="https://testingbot.com/free-online-tools/random-avatar/300?img=3"
              alt="User"
              className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-900"
            />
            <img
              src="https://testingbot.com/free-online-tools/random-avatar/300?img=4"
              alt="User"
              className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-900"
            />
            <img
              src="https://testingbot.com/free-online-tools/random-avatar/300?img=5"
              alt="User"
              className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-900"
            />
          </div>
        </div>
      </section>

      {/* Optional: Animated stats or graphs below hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16 grid md:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow hover:shadow-lg transition">
          <p className="text-gray-500 dark:text-gray-300 text-sm">Active Deployments</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">128</h3>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow hover:shadow-lg transition">
          <p className="text-gray-500 dark:text-gray-300 text-sm">Live Applications</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">87</h3>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow hover:shadow-lg transition">
          <p className="text-gray-500 dark:text-gray-300 text-sm">Rollbacks Performed</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">12</h3>
        </div>
      </section>
    </main>
  );
}
