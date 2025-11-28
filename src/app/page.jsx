"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import TerminalAnimation from "@/components/public/Terminal";
import { FaCloudUploadAlt, FaTerminal, FaProjectDiagram, FaUsers, FaExpandAlt, FaSyncAlt } from "react-icons/fa";
import { useSession } from "next-auth/react";


export default function HomePage() {
  const heroRef = useRef(null);
  const ctaRef = useRef(null);
  const dashboardRef = useRef(null);
  const { data: session } = useSession();

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { duration: 1, ease: "power3.out" } });
    tl.from(heroRef.current, { y: 50, opacity: 0 })
      .from(ctaRef.current, { y: 30, opacity: 0 }, "-=0.5")
      .from(dashboardRef.current, { x: 100, opacity: 0 }, "-=0.5");
  }, []);

  const avatars = Array.from({ length: 6 }, (_, i) => `https://i.pravatar.cc/40?img=${i + 1}`);

  return (
    <main className="relative bg-white text-gray-900 overflow-hidden min-h-screen">
      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 lg:px-12 py-24 flex flex-col-reverse lg:flex-row items-center gap-16">
        <div className="lg:w-1/2 flex flex-col gap-6" ref={heroRef}>
          <h1 className="text-5xl  font-extrabold leading-tight">
            <span className="text-black">Deploy</span>Ease – Effortless Cloud Deployments
          </h1>
          <p className="text-gray-600 text-lg md:text-xl">
            Deploy, manage, and scale your applications in minutes just by One click. Real-time logs, automatic rollback,
            SSH access, and auto-scaling – all in one platform.
          </p>

          {/* Hero Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="flex items-center gap-3">
              <FaCloudUploadAlt className="w-6 h-6 text-black" />
              <span className="text-gray-700 font-medium">Instant Deployments</span>
            </div>
            <div className="flex items-center gap-3">
              <FaTerminal className="w-6 h-6 text-black" />
              <span className="text-gray-700 font-medium">Real-time Logs</span>
            </div>
            <div className="flex items-center gap-3">
              <FaSyncAlt className="w-6 h-6 text-black" />
              <span className="text-gray-700 font-medium">Auto-scaling</span>
            </div>
            <div className="flex items-center gap-3">
              <FaUsers className="w-6 h-6 text-black" />
              <span className="text-gray-700 font-medium">Team Collaboration</span>
            </div>
          </div>

          <div className="flex gap-4 mt-8" ref={ctaRef}>
            <a
              href="/dashboard"
              className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-900 transition"
            >
              Get Started
            </a>
            <a
              href="/features"
              className="px-6 py-3 border border-black text-black rounded-xl font-semibold hover:bg-black hover:text-white transition"
            >
              Learn More
            </a>
          </div>

          
        </div>

        <div className="lg:w-1/2 relative flex justify-center" ref={dashboardRef}>
        <div className="flex flex-col">
          {/* Trusted Avatars */}
          <div className="flex -space-x-3 items-center mb-10">
            {avatars.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="User"
                className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
              />
            ))}
            <span className="ml-4 text-gray-500 font-medium">Trusted by 100+ developers</span>
          </div>

          <img
            src="/dashboard.JPG"
            alt="Dashboard Illustration"
            className="rounded-2xl shadow-2xl w-full max-w-md border border-gray-200"
          />

        </div>
        </div>
      </section>

    
      {/* How it Works Section */}
      <section className="py-24 bg-gray-50">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center gap-4 p-6 bg-white rounded-2xl shadow hover:shadow-2xl transition h-full">
            <FaProjectDiagram className="w-12 h-12 text-black" />
            <h3 className="font-bold text-xl">1. Select Repo</h3>
            <p className="text-gray-600 max-w-xs">
              Choose your GitHub repository and click deploy.
            </p>
          </div>
          <div className="flex flex-col items-center text-center gap-4 p-6 bg-white rounded-2xl shadow hover:shadow-2xl transition h-full">
            <FaTerminal className="w-12 h-12 text-black" />
            <h3 className="font-bold text-xl">2. Configure AWS</h3>
            <p className="text-gray-600 max-w-xs">
              Provide AWS credentials, environment variables, and main file path.
            </p>
          </div>
          <div className="flex flex-col items-center text-center gap-4 p-6 bg-white rounded-2xl shadow hover:shadow-2xl transition h-full">
            <FaCloudUploadAlt className="w-12 h-12 text-black" />
            <h3 className="font-bold text-xl">3. Deploy & Monitor</h3>
            <p className="text-gray-600 max-w-xs">
              Watch live deployment logs, access SSH terminal, and finaly share live url with your team.
            </p>
          </div>
        </div>
      </section>

      {/* Terminal Section */}
      <section className="py-24 bg-gray-100">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Real-time Deployment Simulation
        </h2>
        <TerminalAnimation />
      </section>

      {/* Features Section */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: "One-click Deployment", desc: "Deploy Node, Python, React, or static apps to AWS instantly with auto configuration.", icon: FaCloudUploadAlt },
            { title: "SSH & Logs", desc: "Access live terminal, view logs, and debug your applications directly from your dashboard.", icon: FaTerminal },
            { title: "Auto-scaling & Load Balancer", desc: "Scale your applications automatically using AWS Auto Scaling Groups and Load Balancers.", icon: FaSyncAlt },
            { title: "Environment Management", desc: "Update environment variables anytime – DeployEase automatically rewrites env files.", icon: FaProjectDiagram },
            { title: "Volume Management", desc: "Increase EC2 volumes effortlessly and our platform handles everything in real-time.", icon: FaExpandAlt },
            { title: "Team Collaboration", desc: "Multiple developers? Share deployments and collaborate seamlessly.", icon: FaUsers },
          ].map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div key={idx} className="bg-white border border-gray-200 p-6 rounded-2xl shadow hover:shadow-2xl transition transform hover:scale-105">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="w-6 h-6 text-black" />
                  <h3 className="font-bold text-xl">{feature.title}</h3>
                </div>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-gray-50">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Trusted by Developers Worldwide</h2>
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 max-w-6xl mx-auto">
          {avatars.slice(0, 3).map((url, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow text-center">
              <img src={url} alt="User" className="w-16 h-16 rounded-full mx-auto mb-4" />
              <p className="text-gray-600">"DeployEase made deploying my app a breeze!"</p>
              <span className="text-gray-900 font-medium mt-2 block">Dev {i + 1}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Call To Action Section */}
      <section className="py-24 text-center bg-black text-white">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Deploy Your App?</h2>

        {session ? (
          <>

            <p className="text-gray-300 mb-8">Go to your dashboard to deploy your app. </p>
            <a
              href="/dashboard"
              className="px-8 py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition"
            >
              Go to Dashboard &raquo;
            </a>
          </>
        ) : (

          <>

            <p className="text-gray-300 mb-8">Sign in with GitHub and deploy in minutes. No credit card required.</p>
            <a
              href="/login"
              className="px-8 py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition"
            >
              Sign in with GitHub
            </a>
          </>
        )}

      </section>
    </main>
  );
}
