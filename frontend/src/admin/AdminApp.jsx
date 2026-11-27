import { useEffect, useState } from "react";
import { fetchStats, loginAdmin, logoutAdmin, setChatHalt, switchChatModel } from "./api";
import AdminLogin from "./AdminLogin";
import { ChartPanel, FallbackPanel, LangfusePanel, MonthPanel, OriginPanel, OverviewPanel, PlacesPanel, RawPanel } from "./AdminCharts";

const CHAT_MODELS = [
  { id: "gpt-5-mini", label: "gpt-5-mini" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
];

const SECTIONS = [
  { id: "overview", label: "Übersicht" },
  { id: "charts", label: "Grafiken" },
  { id: "origin", label: "Herkunft" },
  { id: "places", label: "Beliebte Orte" },
  { id: "fallback", label: "LLM-Ausfälle" },
  { id: "month", label: "Monatsreport" },
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

  async function onModel(model) {
    setBusy(true);
    setError("");
    try {
      const result = await switchChatModel(model);
      setStats((current) =>
        current
          ? {
              ...current,
              chat_model: result.model || model,
              chat_model_reachable:
                typeof result.reachable === "boolean" ? result.reachable : current.chat_model_reachable,
            }
          : current,
      );
    } catch (err) {
      if (err.code === "UNAUTHORIZED") {
        setNeedsLogin(true);
        return;
      }
      setError(err instanceof Error ? err.message : "Das Chat-Modell konnte nicht gewechselt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function onHalt(halt) {
    setBusy(true);
    setError("");
    try {
      const result = await setChatHalt(halt);
      setStats((current) =>
        current
          ? { ...current, chat_halt: typeof result.halt === "boolean" ? result.halt : halt }
          : current,
      );
    } catch (err) {
      if (err.code === "UNAUTHORIZED") {
        setNeedsLogin(true);
        return;
      }
      setError(err instanceof Error ? err.message : "Der Not-Aus konnte nicht gesetzt werden.");
    } finally {
      setBusy(false);
    }
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
          <div className="flex items-center gap-3">
            {typeof stats.langfuse_url === "string" && stats.langfuse_url.startsWith("https://") ? (
              <a
                href={stats.langfuse_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                Langfuse
              </a>
            ) : null}
            <button type="button" onClick={onLogout} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300">
              Abmelden
            </button>
          </div>
        </header>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500">Chat-Modell</span>
          {CHAT_MODELS.map((option) => {
            const active = (stats.chat_model || "gpt-5-mini") === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={busy || active}
                onClick={() => onModel(option.id)}
                className={`inline-flex items-center rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-amber-700 text-white" : "bg-white ring-1 ring-stone-200"
                } disabled:opacity-80`}
              >
                {option.label}
                {active && typeof stats.chat_model_reachable === "boolean" ? (
                  <span
                    aria-hidden="true"
                    title={stats.chat_model_reachable ? "erreichbar" : "nicht erreichbar"}
                    className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${
                      stats.chat_model_reachable ? "bg-emerald-400" : "bg-rose-400"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500">Not-Aus</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onHalt(stats.chat_halt !== true)}
            className={`rounded-lg px-3 py-2 text-sm text-white ${
              stats.chat_halt ? "bg-stone-900" : "bg-rose-600"
            } disabled:opacity-80`}
          >
            {stats.chat_halt ? "Chat wieder an" : "Not-Aus"}
          </button>
          {stats.chat_halt ? <span className="text-sm text-rose-700">Chat ist aus</span> : null}
        </div>
        <nav className="flex flex-wrap gap-2">
          {(stats.langfuse
            ? [SECTIONS[0], { id: "langfuse", label: "Langfuse" }, ...SECTIONS.slice(1)]
            : SECTIONS
          ).map((item) => (
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
        {section === "langfuse" ? <LangfusePanel widgets={stats.langfuse} /> : null}
        {section === "charts" ? <ChartPanel charts={stats.charts} /> : null}
        {section === "origin" ? <OriginPanel stats={stats} /> : null}
        {section === "places" ? <PlacesPanel stats={stats} /> : null}
        {section === "fallback" ? <FallbackPanel stats={stats} /> : null}
        {section === "month" ? <MonthPanel report={stats.monthly_report} /> : null}
        {section === "raw" ? (
          <RawPanel events={rawEvents} onConfirm={onRawConfirm} confirmed={rawEvents !== null} busy={busy} />
        ) : null}
      </div>
    </div>
  );
}
