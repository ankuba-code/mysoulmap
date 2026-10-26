async function readJson(response) {
  return response.json().catch(() => null);
}

export async function loginAdmin(username, password) {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Anmeldung fehlgeschlagen.");
    error.code = data?.error?.code || "UNAUTHORIZED";
    throw error;
  }
  return data;
}

export async function logoutAdmin() {
  await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
}

export async function fetchStats(raw = false) {
  const response = await fetch(`/api/admin/stats${raw ? "?raw=true" : ""}`, {
    credentials: "include",
  });
  const data = await readJson(response);
  if (response.status === 401) {
    const error = new Error("UNAUTHORIZED");
    error.code = "UNAUTHORIZED";
    throw error;
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || "Statistik konnte nicht geladen werden.");
  }
  return data;
}
