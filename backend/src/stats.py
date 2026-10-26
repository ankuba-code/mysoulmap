from collections import defaultdict
from datetime import datetime, timedelta

from sqlmodel import Session, col, select

from .models_events import EventType, LlmStatus, UsageEvent


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
                "place_id": event.place_id,
                "llm_latency_ms": event.llm_latency_ms,
                "llm_input_tokens": event.llm_input_tokens,
                "llm_output_tokens": event.llm_output_tokens,
                "llm_status": event.llm_status.value if event.llm_status else None,
                "error_code": event.error_code,
            }
            for event in sorted(events, key=lambda item: item.occurred_at)
        ]
    return payload


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
