// src/App.tsx
import React, { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Results from "./pages/Results";

type Page = "Dashboard" | "Resultater" | "Ranglisten" | "Bøder" | "Admin";

export default function App() {
  const [page, setPage] = useState<Page>(
    () => (localStorage.getItem("padel.page") as Page) || "Dashboard"
  );

  function goto(p: Page) {
    setPage(p);
    try {
      localStorage.setItem("padel.page", p);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-56 shrink-0">
            <div className="text-xl font-semibold mb-4">PadelApp</div>
            <nav className="flex flex-col gap-2">
              {(["Dashboard", "Resultater", "Ranglisten", "Bøder", "Admin"] as Page[]).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => goto(p)}
                    className={`text-left rounded-xl px-3 py-2 border transition ${
                      page === p
                        ? "border-gray-900/20 bg-white shadow-sm"
                        : "border-gray-200 bg-white hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1">
            {page === "Dashboard" && <Dashboard />}
            {page === "Resultater" && <Results />}
            {page === "Ranglisten" && <Stub title="Ranglisten" />}
            {page === "Bøder" && <Stub title="Bøder" />}
            {page === "Admin" && <Stub title="Admin" />}
          </main>
        </div>
      </div>
    </div>
  );
}

function Stub({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-gray-600">Denne side er ikke implementeret endnu.</p>
    </div>
  );
}
