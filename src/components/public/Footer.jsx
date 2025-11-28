"use client";

import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <Logo/>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-sm">
            Fast, simple AWS deployments — realtime logs, autoscaling, browser SSH and more.
          </p>
        </div>

        <div>
          <h4 className="font-medium">Product</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/features" className="hover:underline">Features</Link></li>
            <li><Link href="/pricing" className="hover:underline">Pricing</Link></li>
            <li><Link href="/docs" className="hover:underline">Docs</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-medium">Company</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/about" className="hover:underline">About</Link></li>
            <li><Link href="/contact" className="hover:underline">Contact</Link></li>
            <li><a href="https://github.com" target="_blank" className="flex items-center gap-2 hover:underline"><FaGithub/> GitHub</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 text-sm text-gray-600 dark:text-gray-400 flex flex-col md:flex-row justify-between">
          <span>© {new Date().getFullYear()} DeployEase — built with ❤️</span>
          <div className="flex gap-4 mt-2 md:mt-0">
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
