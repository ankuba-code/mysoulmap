import os
import threading
from dataclasses import dataclass
from datetime import datetime
from ipaddress import ip_address, ip_network

from .models_chat import ChatRequest

OUTPUT_RESERVE_TOKENS = 800
SUBNET_SHARE = 0.1
TIGHT_RATIO = 0.8
DAY_TTL_SECONDS = 2 * 24 * 60 * 60
HOUR_TTL_SECONDS = 3 * 60 * 60
CALL_TTL_SECONDS = 2 * 60

_book = None
_lock = threading.Lock()


@dataclass(frozen=True)
class BudgetLimits:
    daily: int
    hourly: int
    calls_per_minute: int


@dataclass(frozen=True)
class BudgetKeys:
    day: str
    hour: str
    subnet: str
    call: str

    def token_keys(self) -> tuple[str, str, str]:
        return (self.day, self.hour, self.subnet)


@dataclass(frozen=True)
class Reservation:
    ok: bool
    code: str | None
    reserved: int
    keys: BudgetKeys


def current_limits() -> BudgetLimits:
    daily = _positive("GLOBAL_DAILY_TOKEN_LIMIT", 500_000)
    hourly_raw = os.getenv("GLOBAL_HOURLY_TOKEN_LIMIT", "").strip()
    hourly = _positive("GLOBAL_HOURLY_TOKEN_LIMIT", max(1, daily // 24)) if hourly_raw else max(1, daily // 24)
    calls = _positive("GLOBAL_LLM_CALLS_PER_MINUTE", 30)
    return BudgetLimits(daily=daily, hourly=hourly, calls_per_minute=calls)


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4) + OUTPUT_RESERVE_TOKENS


def estimate_chat_tokens(body: ChatRequest) -> int:
    parts = [message.content for message in body.messages]
    if body.ritual_context is not None:
        context = body.ritual_context
        parts.extend([context.element, context.dominant_frequency, *context.lines])
    return estimate_tokens(" ".join(parts))


def subnet_of(ip: str) -> str:
    try:
        address = ip_address(ip)
    except ValueError:
        return "unknown"
    prefix = 24 if address.version == 4 else 48
    return str(ip_network(f"{address}/{prefix}", strict=False))


def budget_keys(now: datetime, subnet: str) -> BudgetKeys:
    day = now.strftime("%Y-%m-%d")
    hour = now.strftime("%Y-%m-%dT%H")
    minute = now.strftime("%Y-%m-%dT%H:%M")
    return BudgetKeys(
        day=f"budget:day:{day}",
        hour=f"budget:hour:{hour}",
        subnet=f"budget:subnet:{hour}:{subnet}",
        call=f"budget:calls:{minute}",
    )


def plan_reserve(
    current: dict[str, int],
    *,
    tokens: int,
    limits: BudgetLimits,
    keys: BudgetKeys,
    recent_user: bool,
) -> tuple[bool, str | None, dict[str, int]]:
    hour_used = current.get(keys.hour, 0)
    if hour_used >= int(limits.hourly * TIGHT_RATIO) and not recent_user:
        return False, "HOURLY_TIGHT", {}
    if current.get(keys.call, 0) + 1 > limits.calls_per_minute:
        return False, "CALL_RATE", {}
    if current.get(keys.day, 0) + tokens > limits.daily:
        return False, "GLOBAL_TOKEN_LIMIT", {}
    if hour_used + tokens > limits.hourly:
        return False, "GLOBAL_TOKEN_LIMIT", {}
    subnet_limit = max(1, int(limits.hourly * SUBNET_SHARE))
    if current.get(keys.subnet, 0) + tokens > subnet_limit:
        return False, "SUBNET_LIMIT", {}
    return True, None, {
        keys.day: tokens,
        keys.hour: tokens,
        keys.subnet: tokens,
        keys.call: 1,
    }


class MemoryBudget:
    def __init__(self) -> None:
        self.values: dict[str, int] = {}
        self.lock = threading.Lock()

    def clear(self) -> None:
        with self.lock:
            self.values.clear()

    def try_reserve(self, *, ip: str, tokens: int, now: datetime, recent_user: bool) -> Reservation:
        limits = current_limits()
        keys = budget_keys(now, subnet_of(ip))
        with self.lock:
            current = {key: self.values.get(key, 0) for key in _tracked(keys)}
            ok, code, updates = plan_reserve(
                current,
                tokens=tokens,
                limits=limits,
                keys=keys,
                recent_user=recent_user,
            )
            if not ok:
                return Reservation(False, code, tokens, keys)
            for key, amount in updates.items():
                self.values[key] = self.values.get(key, 0) + amount
            return Reservation(True, None, tokens, keys)

    def adjust(self, reservation: Reservation, actual: int) -> None:
        if not reservation.ok:
            return
        delta = actual - reservation.reserved
        if delta == 0:
            return
        with self.lock:
            for key in reservation.keys.token_keys():
                self.values[key] = max(0, self.values.get(key, 0) + delta)

    def snapshot(self, now: datetime) -> dict[str, int | float]:
        limits = current_limits()
        keys = budget_keys(now, "unused")
        with self.lock:
            daily = self.values.get(keys.day, 0)
            hourly = self.values.get(keys.hour, 0)
            calls = self.values.get(keys.call, 0)
        return _snapshot(limits, daily, hourly, calls)


class RedisBudget:
    def __init__(self, url: str) -> None:
        import redis

        self.url = url
        self.client = redis.Redis.from_url(url, decode_responses=True, socket_timeout=1)

    def clear(self) -> None:
        cursor = 0
        while True:
            cursor, keys = self.client.scan(cursor=cursor, match="budget:*", count=200)
            if keys:
                self.client.delete(*keys)
            if cursor == 0:
                return

    def try_reserve(self, *, ip: str, tokens: int, now: datetime, recent_user: bool) -> Reservation:
        limits = current_limits()
        keys = budget_keys(now, subnet_of(ip))
        tracked = _tracked(keys)
        for _ in range(5):
            try:
                return self._reserve_once(tracked, keys, tokens, limits, recent_user)
            except Exception as exc:
                from redis.exceptions import WatchError

                if isinstance(exc, WatchError):
                    continue
                return Reservation(False, "GLOBAL_TOKEN_LIMIT", tokens, keys)
        return Reservation(False, "GLOBAL_TOKEN_LIMIT", tokens, keys)

    def _reserve_once(
        self,
        tracked: tuple[str, ...],
        keys: BudgetKeys,
        tokens: int,
        limits: BudgetLimits,
        recent_user: bool,
    ) -> Reservation:
        with self.client.pipeline() as pipe:
            pipe.watch(*tracked)
            current = {key: int(pipe.get(key) or 0) for key in tracked}
            ok, code, updates = plan_reserve(
                current,
                tokens=tokens,
                limits=limits,
                keys=keys,
                recent_user=recent_user,
            )
            if not ok:
                pipe.reset()
                return Reservation(False, code, tokens, keys)
            pipe.multi()
            for key, amount in updates.items():
                pipe.incrby(key, amount)
                pipe.expire(key, _ttl(key))
            pipe.execute()
            return Reservation(True, None, tokens, keys)

    def adjust(self, reservation: Reservation, actual: int) -> None:
        if not reservation.ok:
            return
        delta = actual - reservation.reserved
        if delta == 0:
            return
        token_keys = reservation.keys.token_keys()
        for _ in range(5):
            try:
                with self.client.pipeline() as pipe:
                    pipe.watch(*token_keys)
                    current = {key: int(pipe.get(key) or 0) for key in token_keys}
                    pipe.multi()
                    for key, value in current.items():
                        pipe.set(key, max(0, value + delta))
                        pipe.expire(key, _ttl(key))
                    pipe.execute()
                    return
            except Exception as exc:
                from redis.exceptions import WatchError

                if isinstance(exc, WatchError):
                    continue
                return

    def snapshot(self, now: datetime) -> dict[str, int | float]:
        limits = current_limits()
        keys = budget_keys(now, "unused")
        try:
            daily = int(self.client.get(keys.day) or 0)
            hourly = int(self.client.get(keys.hour) or 0)
            calls = int(self.client.get(keys.call) or 0)
        except Exception:
            daily = hourly = calls = 0
        return _snapshot(limits, daily, hourly, calls)


def get_book():
    global _book
    url = os.getenv("REDIS_URL", "").strip()
    with _lock:
        if url:
            if not isinstance(_book, RedisBudget) or _book.url != url:
                _book = RedisBudget(url)
            return _book
        if not isinstance(_book, MemoryBudget):
            _book = MemoryBudget()
        return _book


def reset_budget() -> None:
    book = get_book()
    book.clear()


def attach_budget_signal(payload: dict, now: datetime) -> dict:
    snap = get_book().snapshot(now)
    merged = dict(payload)
    merged["budget"] = snap
    reasons = list(merged.get("reasons") or [])
    if float(snap["daily_ratio"]) >= TIGHT_RATIO and "daily_tokens" not in reasons:
        reasons.append("daily_tokens")
    if float(snap["hourly_ratio"]) >= TIGHT_RATIO and "hourly_tokens" not in reasons:
        reasons.append("hourly_tokens")
    merged["reasons"] = reasons
    if reasons:
        merged["status"] = "degraded"
    return merged


def _tracked(keys: BudgetKeys) -> tuple[str, ...]:
    return (keys.day, keys.hour, keys.subnet, keys.call)


def _ttl(key: str) -> int:
    if ":day:" in key:
        return DAY_TTL_SECONDS
    if ":calls:" in key:
        return CALL_TTL_SECONDS
    return HOUR_TTL_SECONDS


def _snapshot(limits: BudgetLimits, daily: int, hourly: int, calls: int) -> dict[str, int | float]:
    return {
        "daily_limit": limits.daily,
        "hourly_limit": limits.hourly,
        "daily_reserved": daily,
        "hourly_reserved": hourly,
        "daily_ratio": round(daily / limits.daily, 4) if limits.daily else 0.0,
        "hourly_ratio": round(hourly / limits.hourly, 4) if limits.hourly else 0.0,
        "calls_this_minute": calls,
    }


def _positive(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default
