// src/pages/Dashboard.tsx
import React from "react";
import {
  formatDKK,
  getMostActive,
  getCurrentFridayStreaks,
  getUnpaidFinesTotalDKK,
  getUnpaidFinesCount,
} from "../lib/selectors";

function Card(props: React.PropsWithChildren<{ title?: string; icon?: React.ReactNode; accent?: "blue"|"green"|"rose"|"slate" }>) {
  const ring =
    props.accent === "blue"  ? "rgba(37,99,235,.12)" :
    props.accent === "green" ? "rgba(16,185,129,.12)" :
    props.accent === "rose"  ? "rgba(244,63,94,.12)" :
    "rgba(2,6,23,.08)";
  const border =
    props.accent === "blue"  ? "rgba(37,99,235,.30)" :
    props.accent === "green" ? "rgba(16,185,129,.30)" :
    props.accent === "rose"  ? "rgba(244,63,94,.30)" :
    "rgba(2,6,23,.10)";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: `1px solid ${border}`,
        boxShadow: `0 6px 22px ${ring}`,
        padding: 16,
      }}
    >
      {(props.title || props.icon) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          {props.icon}
          <div style={{ fontWeight: 700 }}>{props.title}</div>
        </div>
      )}
      {props.children}
    </div>
  );
}

function CircleStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "999px",
          background: "#2563EB",
          color: "#fff",
          fontWeight: 800,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 10px 25px rgba(37,99,235,.35)",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 14, color: "#0F172A" }}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const mostActive = getMostActive(3);
  const streaks    = getCurrentFridayStreaks(3);
  const unpaidDKK  = getUnpaidFinesTotalDKK();
  const unpaidCnt  = getUnpaidFinesCount();

  return (
    <div style={{ padding: 18, display: "grid", gap: 14 }}>
      {/* Velkomst / besked */}
      <Card title="Velkommen tilbage 👋" icon={<span>💬</span>} accent="slate">
        <div style={{ fontSize: 14, color: "#334155" }}>
          Klar til at spille? Husk at registrere dine sæt under <b>Resultater</b>.
        </div>
      </Card>

      {/* Bøder øverst */}
      <Card title="Bøder" icon={<span>💸</span>} accent="rose">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 14, color: "#0F172A" }}>
              Ubetalt: <b>{formatDKK(unpaidDKK)}</b> ({unpaidCnt} {unpaidCnt===1?"bøde":"bøder"})
            </div>
            <div style={{ fontSize: 12, color: "#64748B" }}>
              Du kan se detaljer og indberette under <b>Bøder</b>.
            </div>
          </div>
          <a
            href="https://qr.mobilepay.dk/box/ad9ee90d-789f-42e9-aad8-b3b3e6ba7a5a/pay-in"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: "#16A34A",
              border: "1px solid rgba(22,163,74,.45)",
              color: "#fff",
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 10px 25px rgba(22,163,74,.35)",
            }}
          >
            Betal via MobilePay
          </a>
        </div>
      </Card>

      {/* 2-spaltet række: Mest aktive + Fredags-streaks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          <Card title="Mest aktive (Top 3)" icon={<span>🏃‍♂️</span>} accent="blue">
            {mostActive.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748B" }}>Ingen data endnu.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {mostActive.map((r) => (
                  <CircleStat key={r.name} label={r.name} value={r.count} />
                ))}
              </div>
            )}
          </Card>

          <Card title="Aktuel fredag-streak (Top 3)" icon={<span>📆</span>} accent="green">
            {streaks.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748B" }}>Ingen fredagsdata endnu.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {streaks.map((r) => (
                  <CircleStat key={r.name} label={r.name} value={r.streak} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
