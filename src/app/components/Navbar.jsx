// app/components/Navbar.jsx
"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { MdTerminal } from "react-icons/md";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md px-6 py-3 flex justify-between items-center sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <MdTerminal size={28} className="text-blue-600" />
        <Link href="/" className="text-2xl font-bold text-gray-800 dark:text-white">
          DeployEase
        </Link>
      </div>

       {session && (
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Dashboard
            </Link>
            </div>
          )}

      {/* Auth Buttons */}
      <div className="flex items-center gap-4">
        {session ? (
          <div className="flex items-center gap-3">
            <img
              src={session.user.image}
              alt="Avatar"
              className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600"
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
    </nav>
  );
}
