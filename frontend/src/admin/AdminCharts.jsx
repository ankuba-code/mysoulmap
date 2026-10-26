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
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Fallback-Rate" value={llm.fallback_rate} />
        <Stat label="Fehlerquote" value={llm.error_rate} />
        <Stat label="Latenz" value={`${llm.avg_latency_ms ?? 0} ms`} />
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

export function RawPanel({ events, onConfirm, confirmed, busy }) {
  if (!confirmed) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Rohdaten</h2>
        <p className="text-sm text-stone-600">
          Einzelne Events enthalten IP-Adressen. Nur laden, wenn du sie wirklich brauchst.
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
            <th className="py-2 pr-3">Ort</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">IP</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-stone-100">
              <td className="py-2 pr-3">{event.occurred_at}</td>
              <td className="py-2 pr-3">{event.event_type}</td>
              <td className="py-2 pr-3">{event.country_code}</td>
              <td className="py-2 pr-3">{event.place_id || "—"}</td>
              <td className="py-2 pr-3">{event.llm_status || event.error_code || "—"}</td>
              <td className="py-2 pr-3">{event.ip_address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="text-xl font-semibold">{value ?? 0}</dd>
    </div>
  );
}
