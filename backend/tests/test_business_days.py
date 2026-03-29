"""
Tests unitarios para la utilidad de días hábiles.

Periodo de referencia para todos los tests: "2025-1"
Festivos incluidos en ese periodo:
  2025-01-01 (Año Nuevo)
  2025-01-06 (Reyes)
  2025-03-24 (San José trasladado)
  2025-04-17 (Jueves Santo)
  2025-04-18 (Viernes Santo)
  2025-05-01 (Día del Trabajo)
  2025-06-02 (Ascensión)
  2025-06-23 (Corpus Christi)
  2025-06-30 (Sagrado Corazón / San Pedro)
"""
from datetime import date, datetime, timezone

import pytest

from app.utils.business_days import (
    add_business_days,
    count_business_days_between,
    is_overdue,
)

PERIOD = "2025-1"


# ---------------------------------------------------------------------------
# add_business_days
# ---------------------------------------------------------------------------


def test_add_business_days_simple():
    # Lunes 2025-01-13 + 5 días hábiles = Lunes 2025-01-20
    result = add_business_days(date(2025, 1, 13), 5, PERIOD)
    assert result == date(2025, 1, 20)


def test_add_business_days_skips_weekend():
    # Viernes 2025-01-10 + 1 día hábil = Lunes 2025-01-13
    result = add_business_days(date(2025, 1, 10), 1, PERIOD)
    assert result == date(2025, 1, 13)


def test_add_business_days_skips_holiday():
    # Miércoles 2025-04-16 + 1 día hábil = Lunes 2025-04-21
    # (Jueves 17 y Viernes 18 son Semana Santa; Sábado/Domingo se saltan)
    result = add_business_days(date(2025, 4, 16), 1, PERIOD)
    assert result == date(2025, 4, 21)


def test_add_business_days_crosses_multiple_holidays():
    # Viernes 2025-04-11 + 5 días hábiles:
    # skip: sáb 12, dom 13, lun 14 ✓(1), mar 15 ✓(2), mié 16 ✓(3),
    #       jue 17 festivo, vie 18 festivo, sáb 19, dom 20,
    #       lun 21 ✓(4), mar 22 ✓(5)
    result = add_business_days(date(2025, 4, 11), 5, PERIOD)
    assert result == date(2025, 4, 22)


def test_add_15_business_days_jurado_deadline():
    # Lunes 2025-04-07, +15 días hábiles (plazo jurado anteproyecto)
    # Se saltan Semana Santa (jue 17, vie 18) y el finde
    # 08✓1 09✓2 10✓3  11✓4 14✓5 15✓6 16✓7 [17,18 festivos] 21✓8 22✓9 23✓10 24✓11 25✓12 28✓13 29✓14 30✓15
    result = add_business_days(date(2025, 4, 7), 15, PERIOD)
    assert result == date(2025, 4, 30)


# ---------------------------------------------------------------------------
# count_business_days_between
# ---------------------------------------------------------------------------


def test_count_business_days_same_day():
    assert count_business_days_between(date(2025, 1, 13), date(2025, 1, 13), PERIOD) == 0


def test_count_business_days_one_week():
    # Lunes 2025-01-13 → Viernes 2025-01-17: 4 días hábiles (mar-vie)
    assert count_business_days_between(date(2025, 1, 13), date(2025, 1, 17), PERIOD) == 4


def test_count_business_days_skips_weekend():
    # Viernes 2025-01-17 → Lunes 2025-01-20: solo lunes = 1
    assert count_business_days_between(date(2025, 1, 17), date(2025, 1, 20), PERIOD) == 1


def test_count_business_days_skips_holiday():
    # Lunes 2025-04-14 → Lunes 2025-04-21:
    # mar 15✓ mié 16✓ jue 17✗ vie 18✗ sáb✗ dom✗ lun 21✓ = 3
    assert count_business_days_between(date(2025, 4, 14), date(2025, 4, 21), PERIOD) == 3


def test_count_business_days_end_before_start():
    assert count_business_days_between(date(2025, 1, 20), date(2025, 1, 13), PERIOD) == 0


# ---------------------------------------------------------------------------
# is_overdue
# ---------------------------------------------------------------------------


def test_is_overdue_submitted_after_deadline():
    deadline = date(2025, 4, 30)
    submitted = datetime(2025, 5, 1, 10, 0, tzinfo=timezone.utc)
    assert is_overdue(deadline, submitted, PERIOD) is True


def test_is_overdue_submitted_on_deadline():
    deadline = date(2025, 4, 30)
    submitted = datetime(2025, 4, 30, 23, 59, tzinfo=timezone.utc)
    assert is_overdue(deadline, submitted, PERIOD) is False


def test_is_overdue_submitted_before_deadline():
    deadline = date(2025, 4, 30)
    submitted = datetime(2025, 4, 28, 9, 0, tzinfo=timezone.utc)
    assert is_overdue(deadline, submitted, PERIOD) is False
