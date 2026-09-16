import { useEffect, useState } from "react";

export default function App() {
  const [health, setHealth] = useState("prüfe …");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setHealth(data.status === "ok" ? "API erreichbar" : "API antwortet unerwartet");
      })
      .catch(() => {
        setHealth("API gerade nicht erreichbar");
      });
  }, []);

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-16">
        <p className="text-sm uppercase tracking-wide text-stone-500">Soulmap</p>
        <h1 className="text-3xl font-semibold">Reiseempfehlungen aus einem kuratierten Atlas</h1>
        <p className="text-stone-600">
          Die Chat-Oberfläche folgt in einer späteren Phase. Diese Seite bestätigt, dass das
          Web-Frontend ausgeliefert wird.
        </p>
        <p className="text-sm text-stone-500">Status: {health}</p>
      </div>
    </main>
  );
}
