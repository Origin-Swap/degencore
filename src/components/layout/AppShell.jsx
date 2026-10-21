import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import Topbar from "./Topbar";

export default function AppShell() {
  const [search, setSearch] = useState("");
  const location = useLocation();
  const showSearch = location.pathname === "/";

  return (
    <div className="min-h-screen flex bg-canvas">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
        <Topbar search={search} onSearchChange={setSearch} showSearch={showSearch} />
        <main className="flex-1 min-w-0">
          <Outlet context={{ search }} />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
