// app/dashboard/components/Topbar.jsx
"use client";

import { signOut, useSession } from "next-auth/react";

export default function Topbar() {
  const { data: session } = useSession();

  return (
    <header className="h-20 flex items-center justify-between px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm top-0 sticky z-10">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="flex items-center gap-3">
        {session?.user?.image && (
          <img
            src={session.user.image}
            alt="avatar"
            className="w-8 h-8 rounded-full border border-gray-300"
          />
        )}
        <span className="hidden sm:block">{session?.user?.name}</span>
        <button
          onClick={() => signOut()}
          className="ml-3 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
