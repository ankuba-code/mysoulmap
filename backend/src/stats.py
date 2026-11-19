import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, col, select

from .budget import get_book, subnet_of
from .models_events import EventType, LlmStatus, UsageEvent
from .token_limit import TOKEN_LIMIT, TOKEN_NOTICE_RATIO


def default_period(now: datetime) -> tuple[datetime, datetime]:
    end = now.replace(hour=23, minute=59, second=59, microsecond=0)
    start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, end


def format_period(start: datetime, end: datetime) -> str:
    return f"{start.date().isoformat()}/{end.date().isoformat()}"


def _rate(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round(part / whole, 4)


WINDOW_MINUTES = 15
MIN_CHAT_TURNS = 3
RATE_THRESHOLD = 0.05
RATE_LIMIT_THRESHOLD = 50
SHORT_GAP_SECONDS = 3
SHORT_GAP_HINT = 3
IDENTICAL_SHARE_HINT = 0.8
IDENTICAL_MIN_PROMPTS = 3
RATE_LIMITED_HINT = 5
POWER_USER_SHARE = 0.05
BUDGET_CODES = frozenset({"GLOBAL_TOKEN_LIMIT", "SUBNET_LIMIT", "HOURLY_TIGHT", "CALL_RATE"})
TOPIC_OVERLAP = 0.5

_WORD = re.compile(r"[^\W\d_]+", re.UNICODE)
_STOP = frozenset(
    {
        "eine",
        "einen",
        "einer",
        "einem",
        "eines",
        "dass",
        "auch",
        "sich",
        "nicht",
        "oder",
        "nach",
        "über",
        "beim",
        "ohne",
        "aber",
        "schon",
        "noch",
        "sehr",
        "hier",
        "dort",
        "dann",
        "wenn",
        "weil",
        "with",
        "that",
        "this",
        "from",
        "your",
        "have",
        "para",
        "como",
        "este",
        "esta",
    }
)


def summarize_window(events: list[UsageEvent], *, minutes: int = WINDOW_MINUTES) -> dict:
    chat = [
        event
        for event in events
        if event.event_type == EventType.result_view and event.llm_status is not None
    ]
    error_count = sum(1 for event in chat if event.llm_status == LlmStatus.error)
    fallback_count = sum(1 for event in chat if event.llm_status == LlmStatus.fallback)
    errors_by_code: dict[str, int] = defaultdict(int)
    fallback_by_code: dict[str, int] = defaultdict(int)
    for event in chat:
        if not event.error_code:
            continue
        if event.llm_status == LlmStatus.error:
            errors_by_code[event.error_code] += 1
        elif event.llm_status == LlmStatus.fallback:
            fallback_by_code[event.error_code] += 1
    chat_turns = len(chat)
    error_rate = _rate(error_count, chat_turns)
    fallback_rate = _rate(fallback_count, chat_turns)
    rate_limited = sum(1 for event in events if event.event_type == EventType.rate_limited)
    reasons: list[str] = []
    if chat_turns >= MIN_CHAT_TURNS and error_rate > RATE_THRESHOLD:
        reasons.append("error_rate")
    if chat_turns >= MIN_CHAT_TURNS and fallback_rate > RATE_THRESHOLD:
        reasons.append("fallback_rate")
    if rate_limited >= RATE_LIMIT_THRESHOLD:
        reasons.append("rate_limited")
    return {
        "status": "degraded" if reasons else "ok",
        "window_minutes": minutes,
        "chat_turns": chat_turns,
        "error_count": error_count,
        "fallback_count": fallback_count,
        "error_rate": error_rate,
        "fallback_rate": fallback_rate,
        "rate_limited": rate_limited,
        "errors_by_code": dict(errors_by_code),
        "fallback_by_code": dict(fallback_by_code),
        "reasons": reasons,
    }


def chat_window(session: Session, now: datetime, *, minutes: int = WINDOW_MINUTES) -> dict:
    start = now - timedelta(minutes=minutes)
    events = session.exec(
        select(UsageEvent).where(
            UsageEvent.occurred_at >= start,
            UsageEvent.occurred_at <= now,
        )
    ).all()
    return summarize_window(list(events), minutes=minutes)


def aggregate_stats(
    session: Session,
    start: datetime,
    end: datetime,
    *,
    raw: bool = False,
) -> dict:
    statement = select(UsageEvent).where(
        UsageEvent.occurred_at >= start,
        UsageEvent.occurred_at <= end,
    )
    events = session.exec(statement).all()

    form_submissions = sum(1 for event in events if event.event_type == EventType.form_submission)
    result_views = sum(1 for event in events if event.event_type == EventType.result_view)
    affiliate_clicks = sum(1 for event in events if event.event_type == EventType.affiliate_click)

    countries: dict[str, int] = defaultdict(int)
    clicked: dict[str, int] = defaultdict(int)
    errors_by_code: dict[str, int] = defaultdict(int)
    fallback_by_code: dict[str, int] = defaultdict(int)
    daily: dict[str, dict[str, int]] = defaultdict(
        lambda: {"form_submissions": 0, "result_views": 0, "fallbacks": 0}
    )
    latencies: list[int] = []
    error_count = 0
    fallback_count = 0

    for event in events:
        day = event.occurred_at.date().isoformat()
        if event.event_type == EventType.form_submission:
            daily[day]["form_submissions"] += 1
        elif event.event_type == EventType.result_view:
            daily[day]["result_views"] += 1
            if event.llm_status == LlmStatus.fallback:
                daily[day]["fallbacks"] += 1
        if event.event_type != EventType.rate_limited:
            countries[event.country_code] += 1
        if event.event_type == EventType.affiliate_click and event.place_id:
            clicked[event.place_id] += 1
        if event.event_type != EventType.result_view:
            continue
        if event.llm_latency_ms is not None:
            latencies.append(event.llm_latency_ms)
        if event.llm_status == LlmStatus.error:
            error_count += 1
            if event.error_code:
                errors_by_code[event.error_code] += 1
        if event.llm_status == LlmStatus.fallback:
            fallback_count += 1
            if event.error_code:
                fallback_by_code[event.error_code] += 1

    top_countries = [
        {"country_code": code, "count": count}
        for code, count in sorted(countries.items(), key=lambda item: (-item[1], item[0]))[:10]
    ]
    top_clicked = [
        {"place_id": place_id, "clicks": count}
        for place_id, count in sorted(clicked.items(), key=lambda item: (-item[1], item[0]))[:10]
    ]

    payload = {
        "period": format_period(start, end),
        "form_submissions": form_submissions,
        "result_views": result_views,
        "conversion_rate": _rate(result_views, form_submissions),
        "affiliate_clicks": affiliate_clicks,
        "click_through_rate": _rate(affiliate_clicks, result_views),
        "top_countries": top_countries,
        "top_clicked_places": top_clicked,
        "daily": [{"date": day, **counts} for day, counts in sorted(daily.items())],
        "llm_monitoring": {
            "avg_latency_ms": int(sum(latencies) / len(latencies)) if latencies else 0,
            "error_rate": _rate(error_count, result_views),
            "fallback_rate": _rate(fallback_count, result_views),
            "errors_by_code": dict(errors_by_code),
            "fallback_by_code": dict(fallback_by_code),
            "window_15m": chat_window(session, datetime.now(timezone.utc).replace(tzinfo=None)),
        },
    }
    if raw:
        payload["events"] = [
            {
                "id": event.id,
                "event_type": event.event_type.value,
                "occurred_at": event.occurred_at.isoformat(),
                "ip_address": event.ip_address,
                "country_code": event.country_code,
                "os_language": event.os_language,
                "place_id": event.place_id,
                "llm_latency_ms": event.llm_latency_ms,
                "llm_input_tokens": event.llm_input_tokens,
                "llm_output_tokens": event.llm_output_tokens,
                "llm_status": event.llm_status.value if event.llm_status else None,
                "error_code": event.error_code,
                "user_prompt": event.user_prompt,
            }
            for event in sorted(events, key=lambda item: item.occurred_at)
        ]
    payload["monthly_report"] = build_monthly_report(session, end)
    payload["daily_trace"] = build_daily_trace(session, datetime.now(timezone.utc).replace(tzinfo=None))
    return payload


def had_recent_llm_success(session: Session, ip_address: str, now: datetime, minutes: int = 60) -> bool:
    start = now - timedelta(minutes=minutes)
    row = session.exec(
        select(UsageEvent.id).where(
            UsageEvent.ip_address == ip_address,
            UsageEvent.llm_status == LlmStatus.success,
            UsageEvent.occurred_at >= start,
            UsageEvent.occurred_at <= now,
        ).limit(1)
    ).first()
    return row is not None


def build_daily_trace(session: Session, now: datetime) -> dict:
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    events = session.exec(
        select(UsageEvent).where(
            UsageEvent.occurred_at >= start,
            UsageEvent.occurred_at < end,
        )
    ).all()
    limits = get_book().snapshot(now)
    trace = summarize_day(list(events), start, daily_limit=int(limits["daily_limit"]))
    trace["live"] = limits
    return trace


def summarize_day(events: list[UsageEvent], day_start: datetime, *, daily_limit: int) -> dict:
    hours = [0] * 24
    by_ip: dict[str, list[UsageEvent]] = defaultdict(list)
    for event in events:
        if event.occurred_at.date() != day_start.date():
            continue
        tokens = (event.llm_input_tokens or 0) + (event.llm_output_tokens or 0)
        hours[event.occurred_at.hour] += tokens
        by_ip[event.ip_address].append(event)

    users = []
    for ip_address, rows in by_ip.items():
        ordered = sorted(rows, key=lambda item: item.occurred_at)
        tokens = sum((item.llm_input_tokens or 0) + (item.llm_output_tokens or 0) for item in ordered)
        calls = sum(1 for item in ordered if item.llm_status is not None or item.error_code in BUDGET_CODES)
        blocked = sum(1 for item in ordered if item.error_code in BUDGET_CODES)
        share = round(tokens / daily_limit, 4) if daily_limit else 0.0
        users.append(
            {
                "ip_address": ip_address,
                "subnet": subnet_of(ip_address),
                "tokens_used": tokens,
                "share": share,
                "calls": calls,
                "blocked": blocked,
                "last_at": ordered[-1].occurred_at.isoformat(timespec="minutes"),
                "power_user": tokens > 0 and share >= POWER_USER_SHARE,
            }
        )
    users.sort(key=lambda item: (-item["tokens_used"], item["ip_address"]))
    total = sum(hours)
    return {
        "date": day_start.date().isoformat(),
        "daily_limit": daily_limit,
        "tokens_used": total,
        "usage_ratio": round(total / daily_limit, 4) if daily_limit else 0.0,
        "power_user_share": POWER_USER_SHARE,
        "hours": [{"hour": hour, "tokens": amount} for hour, amount in enumerate(hours)],
        "users": users,
        "power_users": [item["ip_address"] for item in users if item["power_user"]],
    }


def month_bounds(moment: datetime) -> tuple[datetime, datetime]:
    start = moment.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def build_monthly_report(session: Session, moment: datetime) -> dict:
    start, end = month_bounds(moment)
    events = session.exec(
        select(UsageEvent).where(
            UsageEvent.occurred_at >= start,
            UsageEvent.occurred_at < end,
        )
    ).all()
    return summarize_month(list(events), start)


def summarize_month(events: list[UsageEvent], month_start: datetime) -> dict:
    by_ip: dict[str, list[UsageEvent]] = defaultdict(list)
    for event in events:
        by_ip[event.ip_address].append(event)

    users = []
    prompts: list[str] = []
    for ip_address, rows in sorted(by_ip.items()):
        ordered = sorted(rows, key=lambda item: item.occurred_at)
        tokens = sum((item.llm_input_tokens or 0) + (item.llm_output_tokens or 0) for item in ordered)
        first = ordered[0].occurred_at
        last = ordered[-1].occurred_at
        excerpts = [item.user_prompt.strip() for item in ordered if item.user_prompt and item.user_prompt.strip()]
        prompts.extend(excerpts)
        rate_limited = sum(1 for item in ordered if item.event_type == EventType.rate_limited)
        short_gaps = _short_gaps(ordered)
        identical_share = _identical_share(excerpts)
        usage_ratio = round(tokens / TOKEN_LIMIT, 4) if TOKEN_LIMIT else 0.0
        hints: list[str] = []
        if rate_limited >= RATE_LIMITED_HINT:
            hints.append("rate_limited")
        if short_gaps >= SHORT_GAP_HINT:
            hints.append("short_intervals")
        if identical_share >= IDENTICAL_SHARE_HINT and len(excerpts) >= IDENTICAL_MIN_PROMPTS:
            hints.append("identical_prompts")
        if usage_ratio >= TOKEN_NOTICE_RATIO:
            hints.append("token_ratio")
        users.append(
            {
                "ip_address": ip_address,
                "tokens_used": tokens,
                "token_limit": TOKEN_LIMIT,
                "usage_ratio": usage_ratio,
                "first_at": first.isoformat(timespec="minutes"),
                "last_at": last.isoformat(timespec="minutes"),
                "active_seconds": int((last - first).total_seconds()),
                "rate_limited": rate_limited,
                "short_gaps": short_gaps,
                "identical_prompt_share": identical_share,
                "hints": hints,
            }
        )
    users.sort(key=lambda item: (-item["tokens_used"], item["ip_address"]))
    return {
        "month": month_start.strftime("%Y-%m"),
        "token_limit": TOKEN_LIMIT,
        "users": users,
        "topics": rank_topics(prompts),
    }


def rank_topics(prompts: list[str]) -> list[dict]:
    clusters: list[_Topic] = []
    for raw in prompts:
        normalized = _normalize(raw)
        if not normalized:
            continue
        tokens = _topic_tokens(normalized)
        placed = False
        for cluster in clusters:
            if cluster.matches(normalized, tokens):
                cluster.add(raw.strip(), normalized)
                placed = True
                break
        if not placed:
            clusters.append(_Topic(raw.strip(), normalized, tokens))
    clusters.sort(key=lambda item: (-item.total, item.label()))
    return [{"label": cluster.label(), "count": cluster.total} for cluster in clusters]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _topic_tokens(normalized: str) -> set[str]:
    return {word for word in _WORD.findall(normalized) if len(word) >= 4 and word not in _STOP}


def _identical_share(excerpts: list[str]) -> float:
    if not excerpts:
        return 0.0
    counts: dict[str, int] = defaultdict(int)
    for excerpt in excerpts:
        counts[_normalize(excerpt)] += 1
    return round(max(counts.values()) / len(excerpts), 4)


def _short_gaps(events: list[UsageEvent]) -> int:
    gaps = 0
    for previous, current in zip(events, events[1:]):
        delta = (current.occurred_at - previous.occurred_at).total_seconds()
        if delta < SHORT_GAP_SECONDS:
            gaps += 1
    return gaps


class _Topic:
    def __init__(self, display: str, normalized: str, tokens: set[str]) -> None:
        self.seed = tokens
        self.total = 1
        self._counts = {normalized: 1}
        self._display = {normalized: display}

    def matches(self, normalized: str, tokens: set[str]) -> bool:
        if normalized in self._counts:
            return True
        if not tokens or not self.seed:
            return False
        shared = tokens & self.seed
        if not shared:
            return False
        return len(shared) / min(len(tokens), len(self.seed)) >= TOPIC_OVERLAP

    def add(self, display: str, normalized: str) -> None:
        self.total += 1
        self._counts[normalized] = self._counts.get(normalized, 0) + 1
        self._display.setdefault(normalized, display)

    def label(self) -> str:
        best = max(self._counts, key=lambda key: (self._counts[key], key))
        return self._display[best]


def purge_old_events(session: Session, now: datetime, months: int = 6) -> int:
    cutoff = _months_ago(now, months)
    stale = session.exec(select(UsageEvent).where(col(UsageEvent.occurred_at) < cutoff)).all()
    for event in stale:
        session.delete(event)
    session.commit()
    return len(stale)


def _months_ago(now: datetime, months: int) -> datetime:
    import calendar

    year = now.year
    month = now.month - months
    while month <= 0:
        month += 12
        year -= 1
    day = min(now.day, calendar.monthrange(year, month)[1])
    return now.replace(year=year, month=month, day=day)
