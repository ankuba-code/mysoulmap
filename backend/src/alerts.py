from dataclasses import dataclass

from .stats import WINDOW_MINUTES

DEFAULT_ALERT_EMAIL = ""
HEALTH_FAILURES_BEFORE_ALERT = 3

SUBJECTS = {
    "health": "Soulmap: API nicht erreichbar",
    "web": "Soulmap: Webserver nicht erreichbar",
    "fallback_rate": "Soulmap: Fallback-Rate über 5 % in 15 Minuten",
    "error_rate": "Soulmap: Fehlerquote über 5 % in 15 Minuten",
    "rate_limited": "Soulmap: auffällig viele Rate-Limits in 15 Minuten",
    "daily_tokens": "Soulmap: Tagesbudget zu 80 % belegt",
    "hourly_tokens": "Soulmap: Stundenkontingent zu 80 % belegt",
    "monitor_not_configured": "Soulmap: Monitoring-Token fehlt",
    "monitor_unauthorized": "Soulmap: Monitoring-Token wird abgelehnt",
    "signals_unreachable": "Soulmap: Signal-Endpunkt nicht erreichbar",
}

SUPPRESSED_DURING_GRACE = frozenset({"health", "web"})


@dataclass(frozen=True)
class Mail:
    key: str
    subject: str
    body: str
    recovery: bool


def describe(key: str, signals: dict | None) -> str:
    if key == "health":
        return (
            "Der Health-Check der API schlägt fehl. "
            "Der Prozess antwortet nicht, die Datenbank ist nicht erreichbar oder der Atlas ist leer."
        )
    if key == "web":
        return "Der Webserver antwortet nicht. Die Seite ist von außen vermutlich nicht erreichbar."
    if key == "monitor_not_configured":
        return "MONITOR_TOKEN ist nicht gesetzt. Die 15-Minuten-Signale können nicht gelesen werden."
    if key == "monitor_unauthorized":
        return "Der Wächter und die API verwenden unterschiedliche MONITOR_TOKEN."
    if key == "signals_unreachable":
        return "Die API läuft, der Signal-Endpunkt antwortet aber nicht mit einer gültigen Kennzahl."
    if signals is None:
        return SUBJECTS.get(key, key)
    minutes = signals.get("window_minutes", WINDOW_MINUTES)
    if key == "fallback_rate":
        return (
            f"In den letzten {minutes} Minuten lag die Fallback-Rate bei "
            f"{float(signals.get('fallback_rate') or 0):.1%} "
            f"({signals.get('fallback_count', 0)} von {signals.get('chat_turns', 0)} Chat-Antworten). "
            f"Codes: {signals.get('fallback_by_code') or '—'}"
        )
    if key == "error_rate":
        return (
            f"In den letzten {minutes} Minuten lag die Fehlerquote bei "
            f"{float(signals.get('error_rate') or 0):.1%} "
            f"({signals.get('error_count', 0)} von {signals.get('chat_turns', 0)} Chat-Antworten). "
            f"Codes: {signals.get('errors_by_code') or '—'}"
        )
    if key == "rate_limited":
        return (
            f"In den letzten {minutes} Minuten wurden {signals.get('rate_limited', 0)} "
            "Anfragen wegen des Rate-Limits abgelehnt."
        )
    budget = signals.get("budget") or {}
    if key == "daily_tokens":
        return (
            "Das Tagesbudget ist zu "
            f"{float(budget.get('daily_ratio') or 0):.0%} belegt "
            f"({budget.get('daily_reserved', 0)} von {budget.get('daily_limit', 0)} Tokens)."
        )
    if key == "hourly_tokens":
        return (
            "Das Stundenkontingent ist zu "
            f"{float(budget.get('hourly_ratio') or 0):.0%} belegt "
            f"({budget.get('hourly_reserved', 0)} von {budget.get('hourly_limit', 0)} Tokens)."
        )
    return SUBJECTS.get(key, key)


def firing_keys(
    *,
    health_failures: int,
    web_failures: int,
    signals_failures: int,
    failure_limit: int,
    signals: dict | None,
    signals_error: str | None,
) -> dict[str, str]:
    if health_failures >= failure_limit:
        return {"health": describe("health", None)}
    active: dict[str, str] = {}
    if web_failures >= failure_limit:
        active["web"] = describe("web", None)
    if signals_error and signals_failures >= 2:
        active[signals_error] = describe(signals_error, None)
        return active
    if signals:
        for key in signals.get("reasons") or []:
            active[str(key)] = describe(str(key), signals)
    return active


class AlertBook:
    def __init__(self) -> None:
        self.sent_at: dict[str, float] = {}

    def plan(self, firing: dict[str, str], now: float, cooldown: float) -> list[Mail]:
        mails: list[Mail] = []
        for key in self.sent_at:
            if key not in firing:
                mails.append(
                    Mail(
                        key=key,
                        subject="Soulmap: wieder in Ordnung",
                        body=(
                            f"Der Alarm „{SUBJECTS.get(key, key)}“ ist beendet. "
                            "Die letzte Prüfung ist unauffällig."
                        ),
                        recovery=True,
                    )
                )
        for key, text in firing.items():
            last = self.sent_at.get(key)
            if last is None or now - last >= cooldown:
                mails.append(
                    Mail(
                        key=key,
                        subject=SUBJECTS.get(key, f"Soulmap: {key}"),
                        body=text,
                        recovery=False,
                    )
                )
        return mails

    def commit(self, mail: Mail, now: float) -> None:
        if mail.recovery:
            self.sent_at.pop(mail.key, None)
            return
        self.sent_at[mail.key] = now
