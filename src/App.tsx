// src/App.tsx
import React from "react";
import Dashboard from "./pages/Dashboard";
import Results from "./pages/Results";
import Admin from "./pages/Admin";
import { ensureSeedPlayers } from "./lib/playerStore";

type PageKey = "Dashboard" | "Resultater" | "Ranglisten" | "Bøder" | "Admin";

const NavItem: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full rounded-lg px-4 py-2 text-left border ${
      active
        ? "border-slate-800 text-slate-900"
        : "border-slate-200 text-slate-700 hover:bg-slate-50"
    }`}
  >
    {label}
  </button>
);

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-semibold">{title}</h2>
    <p className="text-slate-600 mt-2">Denne side er ikke implementeret endnu.</p>
  </div>
);

export default function App() {
  const [current, setCurrent] = React.useState<PageKey>("Dashboard");

  React.useEffect(() => {
    // seed demo-spillere kun hvis der ikke findes nogen
    ensureSeedPlayers();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-[260px] shrink-0">
            <div className="mb-4 text-xl font-semibold">PadelApp</div>
            <div className="flex flex-col gap-3">
              <NavItem label="Dashboard"  active={current === "Dashboard"}  onClick={() => setCurrent("Dashboard")} />
              <NavItem label="Resultater" active={current === "Resultater"} onClick={() => setCurrent("Resultater")} />
              <NavItem label="Ranglisten" active={current === "Ranglisten"} onClick={() => setCurrent("Ranglisten")} />
              <NavItem label="Bøder"      active={current === "Bøder"}      onClick={() => setCurrent("Bøder")} />
              <NavItem label="Admin"      active={current === "Admin"}      onClick={() => setCurrent("Admin")} />
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1">
            {current === "Dashboard"  && <Dashboard />}
            {current === "Resultater" && <Results />}
            {current === "Ranglisten" && <Placeholder title="Ranglisten" />}
            {current === "Bøder"      && <Placeholder title="Bøder" />}
            {current === "Admin"      && <Admin />}
          </main>
        </div>
      </div>
    </div>
  );
}
