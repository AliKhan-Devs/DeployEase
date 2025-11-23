// app/dashboard/components/Sidebar.jsx
"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Upload, Settings } from "lucide-react";

const links = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Your Repos", href: "/dashboard/repos", icon: Upload },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 h-screen bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="p-6 font-bold text-xl flex items-center gap-2 text-blue-600">
        <LayoutDashboard size={28} /> DeployEase
      </div>
      <nav className="mt-6 flex flex-col gap-1 px-2">
        {links.map(({ name, href, icon: Icon }) => (
          <Link
            key={name}
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition ${
              pathname === href ? "bg-blue-600 text-white" : ""
            }`}
          >
            <Icon size={20} />
            {name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
