export function overviewSeries(stats) {
  return stats?.daily ?? [];
}

export function countryBars(stats) {
  return stats?.top_countries ?? [];
}

export function placeBars(stats) {
  return stats?.top_clicked_places ?? [];
}

export function fallbackBars(stats) {
  return Object.entries(stats?.llm_monitoring?.fallback_by_code ?? {}).map(([code, count]) => ({
    code,
    count,
  }));
}

export function errorBars(stats) {
  return Object.entries(stats?.llm_monitoring?.errors_by_code ?? {}).map(([code, count]) => ({
    code,
    count,
  }));
}
