export default function AdminLogin({ onSubmit, error, busy }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <p className="text-sm uppercase tracking-wide text-stone-500">Soulmap Admin</p>
      <h1 className="text-2xl font-semibold">Anmelden</h1>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          Benutzername
          <input
            name="username"
            defaultValue="aku"
            autoComplete="username"
            required
            className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Passwort
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-stone-900 px-3 py-2 text-white disabled:bg-stone-400"
        >
          Anmelden
        </button>
      </form>
    </main>
  );
}
