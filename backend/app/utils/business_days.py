"""
Utilidad de cálculo de días hábiles para el calendario académico USC.

Días hábiles = días calendario − fines de semana − festivos del periodo.
Los festivos se cargan desde USC_HOLIDAYS_FILE (JSON), indexados por periodo
académico ("2025-1", "2025-2", "2026-1", …).

Si el archivo no existe o el periodo no está definido, solo se excluyen
fines de semana (comportamiento seguro por defecto).
"""
import json
import logging
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import FrozenSet

from app.core.config import settings

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).parent.parent.parent


def _resolve_holidays_path() -> Path:
    path = Path(settings.usc_holidays_file)
    if path.is_absolute():
        return path
    return _BACKEND_ROOT / path


@lru_cache(maxsize=1)
def _load_all_holidays() -> dict:
    path = _resolve_holidays_path()
    if not path.exists():
        logger.warning("USC_HOLIDAYS_FILE no encontrado: %s. Solo se excluirán fines de semana.", path)
        return {}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _get_holidays(period: str) -> FrozenSet[date]:
    all_holidays = _load_all_holidays()
    raw = all_holidays.get(period, [])
    return frozenset(date.fromisoformat(d) for d in raw)


def _is_business_day(d: date, holidays: FrozenSet[date]) -> bool:
    return d.weekday() < 5 and d not in holidays


def add_business_days(start: date, n: int, period: str) -> date:
    """
    Retorna la fecha que resulta de sumar n días hábiles a start.
    start no se cuenta — el primer día hábil después de start es el día 1.
    """
    holidays = _get_holidays(period)
    current = start
    counted = 0
    while counted < n:
        current += timedelta(days=1)
        if _is_business_day(current, holidays):
            counted += 1
    return current


def count_business_days_between(start: date, end: date, period: str) -> int:
    """
    Cuenta los días hábiles en el intervalo (start, end], es decir,
    desde el día siguiente a start hasta end inclusive.
    Retorna 0 si end <= start.
    """
    if end <= start:
        return 0
    holidays = _get_holidays(period)
    current = start + timedelta(days=1)
    count = 0
    while current <= end:
        if _is_business_day(current, holidays):
            count += 1
        current += timedelta(days=1)
    return count


def is_overdue(deadline: date, submitted_at: datetime, period: str) -> bool:
    """
    Retorna True si submitted_at.date() es posterior al deadline.
    El periodo se recibe para mantener la firma consistente con las
    demás funciones; no se usa en este cálculo.
    """
    _ = period
    return submitted_at.date() > deadline
