// app/dashboard/components/Sidebar.jsx
"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Folder, ServerCogIcon, Settings, Server, Bot } from "lucide-react";
import { Avatar } from "@/components/ui/avatar"; // Shadecn UI
import { ScrollArea } from "@/components/ui/scroll-area"; // Shadecn UI
import { MdTerminal } from "react-icons/md";
import Logo from "../public/Logo";

const links = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {name:"Instances",href: "/dashboard/instances",icon:Server},
  { name: "Deployments", href: "/dashboard/deployments", icon: ServerCogIcon },
  { name: "Your Repos", href: "/dashboard/repos", icon: Folder },
  { name: "AI Integration", href: "/dashboard/mcp", icon: Bot },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
       
      <Logo/>  
      </div>

      {/* Nav Links */}
      <ScrollArea className="flex-1 p-2 mt-4">
        <nav className="flex flex-col gap-2">
          {links.map(({ name, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={name}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition
                  ${isActive ? "bg-black text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}
                `}
              >
                <Icon size={20} className={isActive ? "text-white" : "text-gray-600 dark:text-gray-300"} />
                {name}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
