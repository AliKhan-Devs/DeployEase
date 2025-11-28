"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { MdTerminal } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import Logo from "./Logo";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        {/* <div className="flex items-center gap-2">
          <MdTerminal size={28} className="text-blue-600" />
          <Link href="/" className="text-xl md:text-2xl font-bold">
            DeployEase
          </Link>
        </div> */}
        <Logo/>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/features" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 transition">
            Features
          </Link>
          <Link href="/pricing" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 transition">
            Pricing
          </Link>
          <Link href="/docs" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 transition">
            Docs
          </Link>

          {session ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">Dashboard</Button>
              </Link>
              <Avatar className="w-9 h-9">
                <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
                <AvatarFallback>{(session.user?.name || "U").slice(0,1)}</AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Logout
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => signIn("github")} className="bg-black text-white hover:bg-gray-900 transition">
              Sign in with GitHub
            </Button>
          )}
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-6">
              <div className="flex flex-col gap-5">
                <Link href="/" className="text-lg font-semibold">Home</Link>
                <Link href="/features" className="text-base">Features</Link>
                <Link href="/pricing" className="text-base">Pricing</Link>
                <Link href="/docs" className="text-base">Docs</Link>
                {session ? (
                  <>
                    <Link href="/dashboard" className="text-base">Dashboard</Link>
                    <Button variant="destructive" onClick={() => signOut()}>Logout</Button>
                  </>
                ) : (
                  <Button onClick={() => signIn("github")} className="bg-black text-white hover:bg-gray-900 transition">
                    Sign in with GitHub
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
