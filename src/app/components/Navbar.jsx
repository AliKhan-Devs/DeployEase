"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { MdTerminal } from "react-icons/md";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <MdTerminal size={30} className="text-blue-600" />
            <Link href="/" className="text-xl font-bold text-gray-800 dark:text-white">
              DeployEase
            </Link>
          </div>

          {/* Nav Links */}
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Home
            </Link>
            {session && (
              <Link
                href="/dashboard"
                className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-2">
                <img
                  src={session.user.image}
                  alt="User avatar"
                  className="w-10 h-10 rounded-full border border-gray-300"
                />
                <span className="text-gray-800 dark:text-gray-200 font-medium">
                  {session.user.name}
                </span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("github")}
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-900"
              >
                Sign in with GitHub
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
