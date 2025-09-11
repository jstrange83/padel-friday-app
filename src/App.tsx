import React, { useEffect, useState } from "react";
import ResultsPage from "./pages/Results";

type Page = "Dashboard" | "Resultater" | "Ranglisten" | "Bøder" | "Admin";

export default function App() {
  const [page, setPage] = useState<Page>("Resultater");

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", color: "#111827" }}>
      <div style={{ display: "flex" }}>
        <aside
          style={{
            width: 220,
            background: "#FFFFFF",
            borderRight: "1px solid #E5E7EB",
            padding: 16,
            minHeight: "100vh",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>PadelApp</div>
          {(["Dashboard", "Resultater", "Ranglisten", "Bøder", "Admin"] as Page[]).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                marginBottom: 6,
                border: "1px solid #E5E7EB",
                background: page === p ? "#EEF2FF" : "#fff",
                color: page === p ? "#3730A3" : "#111827",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </aside>

        <main style={{ flex: 1, padding: 24 }}>
          {page === "Resultater" && <ResultsPage />}
          {page !== "Resultater" && (
            <div
              style={{
                padding: 24,
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 16,
                boxShadow: "0 2px 10px rgba(16,24,40,.06)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{page}</div>
              <div style={{ marginTop: 8, color: "#6B7280" }}>Denne side er ikke implementeret endnu.</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
