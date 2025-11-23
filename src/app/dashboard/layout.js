// app/dashboard/layout.js
import Sidebar from "./components/Sidebar";
// import DashboardNavbar from "./components/DashboardNavbar"; // optional
import "../globals.css";
import Topbar from "./components/Topbar";

export const metadata = {
  title: "Dashboard - DeployEase",
};

export default function DashboardLayout({ children }) {
  return (
    
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left sidebar stays fixed */}
      <aside className="flex-shrink-0 w-64 top-0 sticky h-screen">
         <Sidebar />
      </aside>

      {/* Right side content */}
      <div className="flex-1">
        <Topbar/>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
