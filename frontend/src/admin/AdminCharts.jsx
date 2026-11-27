import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { countryBars, errorBars, fallbackBars, overviewSeries, placeBars } from "./series";

function ChartFrame({ title, children, empty }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {empty ? <p className="text-sm text-stone-500">Keine Daten</p> : children}
    </section>
  );
}

export function OverviewPanel({ stats }) {
  const rows = overviewSeries(stats);
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Formulare" value={stats.form_submissions} />
        <Stat label="Ergebnisse" value={stats.result_views} />
        <Stat label="Conversion" value={stats.conversion_rate} />
        <Stat label="CTR" value={stats.click_through_rate} />
      </dl>
      <ChartFrame title="Formulare vs. Ergebnisse" empty={!rows.length}>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="form_submissions" name="Formulare" stroke="#1c1917" />
              <Line type="monotone" dataKey="result_views" name="Ergebnisse" stroke="#b45309" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </div>
  );
}

export function LangfusePanel({ widgets }) {
  if (!widgets) return null;
  if (widgets.error) {
    return <p className="text-sm text-rose-700">Die Langfuse-Kennzahlen sind gerade nicht erreichbar.</p>;
  }
  const days = widgets.days || [];
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Langfuse, {widgets.period_days} Tage</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Aufrufe" value={widgets.calls} />
        <Stat label="Kosten" value={`${Number(widgets.cost_usd || 0).toFixed(4)} $`} />
        <Stat label="Tokens" value={widgets.tokens} />
        <Stat label="Latenz p95" value={`${widgets.latency_ms ?? 0} ms`} />
      </dl>
      <ChartFrame title="Aufrufe pro Tag" empty={!days.length}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="calls" name="Aufrufe" fill="#b45309" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </div>
  );
}

export function OriginPanel({ stats }) {
  const rows = countryBars(stats);
  return (
    <ChartFrame title="Top-Länder" empty={!rows.length}>
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country_code" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Events" fill="#1c1917" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function PlacesPanel({ stats }) {
  const rows = placeBars(stats);
  return (
    <ChartFrame title="Beliebte Orte" empty={!rows.length}>
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="place_id" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="clicks" name="Klicks" fill="#1c1917" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function FallbackPanel({ stats }) {
  const llm = stats.llm_monitoring || {};
  const fallbacks = fallbackBars(stats);
  const errors = errorBars(stats);
  const days = overviewSeries(stats);
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Fallback-Rate" value={llm.fallback_rate} />
        <Stat label="Fehlerquote" value={llm.error_rate} />
        <Stat label="Latenz" value={`${llm.avg_latency_ms ?? 0} ms`} />
        <Stat label="15 Minuten" value={windowLabel(llm.window_15m)} />
      </dl>
      <ChartFrame title="Fallbacks pro Tag" empty={!days.length}>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="fallbacks" name="Fallbacks" stroke="#9f1239" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
      <ChartFrame title="Fallback nach Code" empty={!fallbacks.length}>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={fallbacks}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="code" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Anzahl" fill="#9f1239" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
      <ChartFrame title="Fehler nach Code" empty={!errors.length}>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={errors}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="code" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Anzahl" fill="#44403c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </div>
  );
}

const HINTS = {
  rate_limited: "viele Rate-Limits",
  short_intervals: "kurze Abstände",
  identical_prompts: "gleiche Prompts",
  token_ratio: "Token-Limit nah",
};

const CHARTS = [
  ["world", "Weltkarte"],
  ["daily", "Verlauf"],
  ["topics", "Themen"],
  ["tokens", "Tokens"],
];

export function ChartPanel({ charts }) {
  const images = CHARTS.filter(([key]) => charts?.[key]);
  if (!images.length) {
    return <p className="text-sm text-stone-500">Keine Grafiken</p>;
  }
  return (
    <div className="space-y-6">
      {images.map(([key, title]) => (
        <figure key={key} className="space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <img src={charts[key]} alt={title} className="w-full rounded-xl bg-white" />
        </figure>
      ))}
    </div>
  );
}

export function MonthPanel({ report }) {
  const data = report || { users: [], topics: [] };
  const users = data.users || [];
  const topics = data.topics || [];
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Monatsreport {data.month || ""}</h2>
        <p className="text-sm text-stone-600">
          Hinweise beschreiben Auffälligkeiten. Sie stufen niemanden als Bot ein.
        </p>
        {users.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="py-2 pr-3">IP</th>
                  <th className="py-2 pr-3">Tokens</th>
                  <th className="py-2 pr-3">Nutzungszeit</th>
                  <th className="py-2 pr-3">Rate-Limits</th>
                  <th className="py-2 pr-3">Kurze Abstände</th>
                  <th className="py-2 pr-3">Gleicher Prompt</th>
                  <th className="py-2 pr-3">Hinweise</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.ip_address} className="border-b border-stone-100">
                    <td className="py-2 pr-3">{user.ip_address}</td>
                    <td className="py-2 pr-3">
                      {user.tokens_used} / {user.token_limit}
                    </td>
                    <td className="py-2 pr-3">
                      {user.first_at} – {user.last_at} ({user.active_seconds} s)
                    </td>
                    <td className="py-2 pr-3">{user.rate_limited}</td>
                    <td className="py-2 pr-3">{user.short_gaps}</td>
                    <td className="py-2 pr-3">{user.identical_prompt_share}</td>
                    <td className="py-2 pr-3">
                      {(user.hints || []).map((hint) => HINTS[hint] || hint).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-stone-500">Keine Daten</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Themen</h2>
        {topics.length ? (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="py-2 pr-3">Thema</th>
                <th className="py-2 pr-3">Anzahl</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.label} className="border-b border-stone-100">
                  <td className="py-2 pr-3">{topic.label}</td>
                  <td className="py-2 pr-3">{topic.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-stone-500">Keine Daten</p>
        )}
      </section>
    </div>
  );
}

export function RawPanel({ events, onConfirm, confirmed, busy }) {
  if (!confirmed) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Rohdaten</h2>
        <p className="text-sm text-stone-600">
          Einzelne Events enthalten IP-Adressen und den gekürzten Prompt. Nur laden, wenn du sie wirklich brauchst.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white"
        >
          Rohdaten laden
        </button>
      </section>
    );
  }
  if (!events?.length) {
    return <p className="text-sm text-stone-500">Keine Events</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200">
            <th className="py-2 pr-3">Zeit</th>
            <th className="py-2 pr-3">Typ</th>
            <th className="py-2 pr-3">Land</th>
            <th className="py-2 pr-3">OS-Sprache</th>
            <th className="py-2 pr-3">Ort</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">IP</th>
            <th className="py-2 pr-3">Prompt</th>
            <th className="py-2 pr-3">Bewertung</th>
            <th className="py-2 pr-3">Feedback</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-stone-100">
              <td className="py-2 pr-3">{event.occurred_at}</td>
              <td className="py-2 pr-3">{event.event_type}</td>
              <td className="py-2 pr-3">{event.country_code}</td>
              <td className="py-2 pr-3">{event.os_language || "—"}</td>
              <td className="py-2 pr-3">{event.place_id || "—"}</td>
              <td className="py-2 pr-3">{event.llm_status || event.error_code || "—"}</td>
              <td className="py-2 pr-3">{event.ip_address}</td>
              <td className="py-2 pr-3">{event.user_prompt || "—"}</td>
              <td className="py-2 pr-3">{event.feedback_vote || "—"}</td>
              <td className="py-2 pr-3">{event.feedback_text || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const WINDOW_REASONS = {
  fallback_rate: "Fallback",
  error_rate: "Fehler",
  rate_limited: "Rate-Limit",
};

function windowLabel(window) {
  if (!window) return "—";
  if (window.status === "degraded") {
    const reasons = (window.reasons || []).map((reason) => WINDOW_REASONS[reason] || reason);
    return reasons.join(", ") || "auffällig";
  }
  if ((window.chat_turns ?? 0) < 3) return "wenig Daten";
  return "ruhig";
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="text-xl font-semibold">{value ?? 0}</dd>
    </div>
  );
}
