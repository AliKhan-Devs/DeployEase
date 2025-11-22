// app/dashboard/components/Sidebar.jsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Upload, Settings } from "lucide-react";
import { MdTerminal } from "react-icons/md";
const links = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Your Repos", href: "/dashboard/repos", icon: Upload },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700">
      {/* <div className="p-6 font-bold text-xl tracking-tight flex items-center"><MdTerminal size={30} className="text-blue-600 mr-2"/><span className="text-blue-600">Deploy</span>Ease</div> */}
      <nav className="space-y-1 px-4 mt-6">
        {links.map(({ name, href, icon: Icon }) => (
          <Link
            key={name}
            href={href}
            className={`flex items-center gap-3 p-3 rounded-lg transition ${
              pathname === href
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700"
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
