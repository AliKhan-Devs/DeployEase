// app/dashboard/layout.jsx
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar />
      <div className="flex flex-col flex-1">
        {/* <Topbar /> */}
        <main className="p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
