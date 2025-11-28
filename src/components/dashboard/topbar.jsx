// app/dashboard/components/Topbar.jsx
"use client";

import { signOut, useSession } from "next-auth/react";
import { Avatar } from "../ui/avatar"; // Shadecn UI
import { Button } from "../ui/button";
import { AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";

export default function Topbar() {
  const { data: session } = useSession();


  return (
    <header className="h-20 flex items-center justify-between px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-20">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>

      <div className="flex items-center gap-4">
        {session?.user && (
          <div className="flex items-center gap-2">

            <Avatar className="w-9 h-9">
              <AvatarImage src={session.user.image} />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <span className="hidden sm:block text-gray-700 dark:text-gray-200 font-medium">{session.user.name}</span>
          </div>
        )}
        <Button variant="destructive" size="sm" onClick={() => signOut()}>
          Logout
        </Button>
      </div>
    </header>
  );
}
