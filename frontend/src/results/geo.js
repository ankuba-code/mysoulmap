export async function loadGeo() {
  try {
    const response = await fetch("/api/geo");
    if (!response.ok) {
      return null;
    }
    const body = await response.json();
    if (body.latitude == null || body.longitude == null || body.accuracy_radius_km == null) {
      return null;
    }
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy_radius_km);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy <= 0) {
      return null;
    }
    return {
      country_code: typeof body.country_code === "string" ? body.country_code : "XX",
      latitude,
      longitude,
      accuracy_radius_km: accuracy,
    };
  } catch {
    return null;
  }
}
