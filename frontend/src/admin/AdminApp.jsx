import { useEffect, useState } from "react";
import { fetchStats, loginAdmin, logoutAdmin } from "./api";
import AdminLogin from "./AdminLogin";
import { FallbackPanel, OriginPanel, OverviewPanel, PlacesPanel, RawPanel } from "./AdminCharts";

const SECTIONS = [
  { id: "overview", label: "Übersicht" },
  { id: "origin", label: "Herkunft" },
  { id: "places", label: "Beliebte Orte" },
  { id: "fallback", label: "LLM-Ausfälle" },
  { id: "raw", label: "Rohdaten" },
];

export default function AdminApp() {
  const [stats, setStats] = useState(null);
  const [rawEvents, setRawEvents] = useState(null);
  const [section, setSection] = useState("overview");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(raw = false) {
    const payload = await fetchStats(raw);
    setStats(payload);
    if (raw) {
      setRawEvents(payload.events || []);
    }
    setNeedsLogin(false);
  }

  useEffect(() => {
    load().catch((err) => {
      if (err.code === "UNAUTHORIZED") {
        setNeedsLogin(true);
        return;
      }
      setError(err.message);
    });
  }, []);

  async function onLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await loginAdmin(String(form.get("username") || ""), String(form.get("password") || ""));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
      setNeedsLogin(true);
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await logoutAdmin();
    setStats(null);
    setRawEvents(null);
    setNeedsLogin(true);
  }

  async function onRawConfirm() {
    setBusy(true);
    setError("");
    try {
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rohdaten fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <AdminLogin onSubmit={onLogin} error={error} busy={busy} />
      </div>
    );
  }

  if (!stats) {
    return <p className="p-6 text-sm text-stone-500">Lädt …</p>;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-stone-500">Soulmap Admin</p>
            <h1 className="text-2xl font-semibold">Statistik {stats.period}</h1>
          </div>
          <button type="button" onClick={onLogout} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300">
            Abmelden
          </button>
        </header>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <nav className="flex flex-wrap gap-2">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`rounded-lg px-3 py-2 text-sm ${
                section === item.id ? "bg-stone-900 text-white" : "bg-white ring-1 ring-stone-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {section === "overview" ? <OverviewPanel stats={stats} /> : null}
        {section === "origin" ? <OriginPanel stats={stats} /> : null}
        {section === "places" ? <PlacesPanel stats={stats} /> : null}
        {section === "fallback" ? <FallbackPanel stats={stats} /> : null}
        {section === "raw" ? (
          <RawPanel events={rawEvents} onConfirm={onRawConfirm} confirmed={rawEvents !== null} busy={busy} />
        ) : null}
      </div>
    </div>
  );
}
